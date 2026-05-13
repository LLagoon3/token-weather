import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  installSystemdUnit,
  uninstallSystemdUnit,
  installLaunchAgent,
  uninstallLaunchAgent,
  installTaskScheduler,
  uninstallTaskScheduler,
  installOsService,
  uninstallOsService,
  parseYesNo,
} from '../src/os-service-installer.js';

const INPUT = {
  nodeBinPath: '/usr/bin/node',
  cliScriptPath: '/cli/bin/token-weather.js',
  homeDir: '/home/test',
};

function makeMockFs({ files = new Map() } = {}) {
  const calls = [];
  return {
    fs: {
      existsSync: (p) => files.has(p),
      readFileSync: (p) => files.get(p) ?? '',
      writeFileSync: (p, c) => {
        files.set(p, c);
        calls.push({ op: 'write', path: p });
      },
      mkdirSync: (p) => {
        calls.push({ op: 'mkdir', path: p });
      },
      unlinkSync: (p) => {
        files.delete(p);
        calls.push({ op: 'unlink', path: p });
      },
    },
    files,
    calls,
  };
}

function makeMockExec({ throwOn = {}, returnFor = {} } = {}) {
  const calls = [];
  return {
    impl: (cmd, args) => {
      const key = `${cmd} ${args.join(' ')}`;
      calls.push({ cmd, args });
      if (throwOn[cmd]) throw new Error(throwOn[cmd]);
      return returnFor[key] ?? '';
    },
    calls,
  };
}

// ─── parseYesNo ─────────────────────────────────────────────────────────────

describe('parseYesNo', () => {
  it('빈 입력은 default 반환', () => {
    assert.equal(parseYesNo('', true), true);
    assert.equal(parseYesNo('', false), false);
    assert.equal(parseYesNo('  ', true), true);
  });
  it('y / yes 는 true', () => {
    assert.equal(parseYesNo('y', false), true);
    assert.equal(parseYesNo('Y', false), true);
    assert.equal(parseYesNo('yes', false), true);
    assert.equal(parseYesNo('YES', false), true);
  });
  it('n / no 는 false', () => {
    assert.equal(parseYesNo('n', true), false);
    assert.equal(parseYesNo('NO', true), false);
  });
  it('알 수 없는 입력은 default 반환', () => {
    assert.equal(parseYesNo('maybe', true), true);
    assert.equal(parseYesNo('123', false), false);
  });
});

// ─── installSystemdUnit ─────────────────────────────────────────────────────

describe('installSystemdUnit (issue #138)', () => {
  it('systemd 부재 (systemctl 실행 실패) → status skipped', async () => {
    const mockFs = makeMockFs();
    const mockExec = makeMockExec({ throwOn: { systemctl: 'command not found' } });
    const r = await installSystemdUnit(INPUT, {
      fsImpl: mockFs.fs,
      execImpl: mockExec.impl,
      env: { HOME: '/home/test', USER: 'test' },
    });
    assert.equal(r.status, 'skipped');
    assert.match(r.message, /systemd 미감지/);
  });

  it('정상 install 시퀀스 — mkdir / write / daemon-reload / enable / linger', async () => {
    const mockFs = makeMockFs();
    const mockExec = makeMockExec();
    const r = await installSystemdUnit(INPUT, {
      fsImpl: mockFs.fs,
      execImpl: mockExec.impl,
      env: { HOME: '/home/test', USER: 'test' },
    });
    assert.equal(r.status, 'installed');
    assert.ok(mockFs.calls.some((c) => c.op === 'mkdir'));
    assert.ok(mockFs.calls.some((c) => c.op === 'write'));
    const cmds = mockExec.calls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    assert.ok(cmds.some((c) => c.includes('systemctl --version')));
    assert.ok(cmds.some((c) => c.includes('systemctl --user daemon-reload')));
    assert.ok(cmds.some((c) => c.includes('systemctl --user enable --now')));
    assert.ok(cmds.some((c) => c.includes('loginctl enable-linger test')));
  });

  it('기존 service 파일 + 내용 다름 + confirm n → status skipped', async () => {
    const servicePath = '/home/test/.config/systemd/user/token-weather-bot.service';
    const mockFs = makeMockFs({ files: new Map([[servicePath, 'old content']]) });
    const mockExec = makeMockExec();
    let confirmAsked = false;
    const r = await installSystemdUnit(INPUT, {
      fsImpl: mockFs.fs,
      execImpl: mockExec.impl,
      confirmFn: async (_q, _d) => {
        confirmAsked = true;
        return false; // n
      },
      env: { HOME: '/home/test', USER: 'test' },
    });
    assert.equal(confirmAsked, true);
    assert.equal(r.status, 'skipped');
    assert.match(r.message, /덮어쓰기 거부/);
    // write / mkdir 안 일어남.
    assert.equal(
      mockFs.calls.some((c) => c.op === 'write'),
      false,
    );
  });

  it('linger 실패는 warning + 계속 (status 는 여전히 installed)', async () => {
    const mockFs = makeMockFs();
    const mockExec = makeMockExec({ throwOn: { loginctl: 'permission denied' } });
    const logs = [];
    const r = await installSystemdUnit(INPUT, {
      fsImpl: mockFs.fs,
      execImpl: mockExec.impl,
      log: (m) => logs.push(m),
      env: { HOME: '/home/test', USER: 'test' },
    });
    assert.equal(r.status, 'installed');
    assert.ok(logs.some((l) => l.includes('loginctl enable-linger 실패')));
  });

  it('중간 단계 실패 시 cleanup (write 한 파일 unlink) + status failed', async () => {
    const mockFs = makeMockFs();
    const mockExec = makeMockExec({
      throwOn: { systemctl: '' }, // 'systemctl' 명령에서 throw — 첫 호출은 --version, 그건 ok ... mock 단순화.
    });
    // throwOn 키 매칭 단순화 — 우선 첫 systemctl 도 fail 하면 skipped 경로라 cleanup 안 함.
    // 더 정밀한 케이스: --version 만 ok 후 daemon-reload 에서 fail.
    const callCounts = { systemctl: 0 };
    const r = await installSystemdUnit(INPUT, {
      fsImpl: mockFs.fs,
      execImpl: (cmd, args) => {
        if (cmd === 'systemctl') {
          callCounts.systemctl += 1;
          if (callCounts.systemctl === 1) return ''; // --version ok
          throw new Error('daemon-reload failed');
        }
        return '';
      },
      env: { HOME: '/home/test', USER: 'test' },
    });
    assert.equal(r.status, 'failed');
    // cleanup — write 했던 파일이 unlink 됨.
    assert.ok(mockFs.calls.some((c) => c.op === 'unlink'));
  });
});

// ─── uninstallSystemdUnit ──────────────────────────────────────────────────

describe('uninstallSystemdUnit (issue #138)', () => {
  it('service 파일 없음 → status skipped', async () => {
    const mockFs = makeMockFs();
    const mockExec = makeMockExec();
    const r = await uninstallSystemdUnit({
      fsImpl: mockFs.fs,
      execImpl: mockExec.impl,
      env: { HOME: '/home/test', USER: 'test' },
    });
    assert.equal(r.status, 'skipped');
    assert.match(r.message, /service 파일 없음/);
  });

  it('confirm 거부 → status skipped', async () => {
    const servicePath = '/home/test/.config/systemd/user/token-weather-bot.service';
    const mockFs = makeMockFs({ files: new Map([[servicePath, 'existing']]) });
    const mockExec = makeMockExec();
    const r = await uninstallSystemdUnit({
      fsImpl: mockFs.fs,
      execImpl: mockExec.impl,
      confirmFn: async () => false,
      env: { HOME: '/home/test', USER: 'test' },
    });
    assert.equal(r.status, 'skipped');
    assert.equal(
      mockFs.calls.some((c) => c.op === 'unlink'),
      false,
    );
  });

  it('정상 uninstall — disable + unlink + linger 해제', async () => {
    const servicePath = '/home/test/.config/systemd/user/token-weather-bot.service';
    const mockFs = makeMockFs({ files: new Map([[servicePath, 'existing']]) });
    const mockExec = makeMockExec();
    const r = await uninstallSystemdUnit({
      fsImpl: mockFs.fs,
      execImpl: mockExec.impl,
      confirmFn: async () => true,
      env: { HOME: '/home/test', USER: 'test' },
    });
    assert.equal(r.status, 'installed');
    const cmds = mockExec.calls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    assert.ok(cmds.some((c) => c.includes('systemctl --user disable --now')));
    assert.ok(cmds.some((c) => c.includes('loginctl disable-linger test')));
    assert.ok(mockFs.calls.some((c) => c.op === 'unlink' && c.path === servicePath));
  });
});

// ─── installLaunchAgent / installTaskScheduler skip detect ──────────────────

describe('installLaunchAgent (issue #138)', () => {
  it('launchctl 미감지 → status skipped', async () => {
    const r = await installLaunchAgent(INPUT, {
      fsImpl: makeMockFs().fs,
      execImpl: makeMockExec({ throwOn: { launchctl: 'not found' } }).impl,
      env: { HOME: '/home/test' },
    });
    assert.equal(r.status, 'skipped');
    assert.match(r.message, /launchctl 미감지/);
  });
});

describe('installTaskScheduler (issue #138)', () => {
  it('schtasks 미감지 → status skipped', async () => {
    const r = await installTaskScheduler(INPUT, {
      execImpl: makeMockExec({ throwOn: { schtasks: 'not found' } }).impl,
    });
    assert.equal(r.status, 'skipped');
    assert.match(r.message, /schtasks 미감지/);
  });
});

// ─── uninstallLaunchAgent / uninstallTaskScheduler ──────────────────────────

describe('uninstallLaunchAgent (issue #138)', () => {
  it('plist 부재 → status skipped', async () => {
    const r = await uninstallLaunchAgent({
      fsImpl: makeMockFs().fs,
      execImpl: makeMockExec().impl,
      env: { HOME: '/home/test' },
    });
    assert.equal(r.status, 'skipped');
  });
});

describe('uninstallTaskScheduler (issue #138)', () => {
  it('confirm 거부 → status skipped', async () => {
    const r = await uninstallTaskScheduler({
      execImpl: makeMockExec().impl,
      confirmFn: async () => false,
    });
    assert.equal(r.status, 'skipped');
  });
});

// ─── installOsService / uninstallOsService — platform dispatch ──────────────

describe('installOsService / uninstallOsService platform dispatch', () => {
  it('지원하지 않는 platform → status skipped', async () => {
    const r = await installOsService(INPUT, {
      platform: 'aix',
      fsImpl: makeMockFs().fs,
      execImpl: makeMockExec().impl,
    });
    assert.equal(r.status, 'skipped');
    assert.match(r.message, /지원하지 않는 platform/);
  });

  it('uninstall 도 지원 외 platform skip', async () => {
    const r = await uninstallOsService({ platform: 'aix' });
    assert.equal(r.status, 'skipped');
  });

  it('linux platform → systemd 분기 (systemctl 부재 skip 으로 확인)', async () => {
    const r = await installOsService(INPUT, {
      platform: 'linux',
      fsImpl: makeMockFs().fs,
      execImpl: makeMockExec({ throwOn: { systemctl: 'not found' } }).impl,
      env: { HOME: '/home/test' },
    });
    assert.match(r.message, /systemd 미감지/);
  });
});
