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
    // systemctl --version (첫 호출) 은 ok, 그 다음 daemon-reload 에서 fail.
    const callCounts = { systemctl: 0 };
    const r = await installSystemdUnit(INPUT, {
      fsImpl: mockFs.fs,
      execImpl: (cmd) => {
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

// ─── installSystemdUnit — review 2 follow-up: guard 보강 ────────────────────

describe('installSystemdUnit guard 보강 (PR #140 review 2)', () => {
  it('HOME 없음 → status skipped (path.join throw 회피)', async () => {
    // INPUT.homeDir 도 비워서 input.homeDir ?? env.HOME 둘 다 falsy 만들기.
    const r = await installSystemdUnit(
      { nodeBinPath: '/usr/bin/node', cliScriptPath: '/cli.js' },
      {
        fsImpl: makeMockFs().fs,
        execImpl: makeMockExec().impl,
        env: {}, // HOME 부재.
      },
    );
    assert.equal(r.status, 'skipped');
    assert.match(r.message, /HOME 환경변수/);
  });

  it('USER 없음 → install 성공 + loginctl 단계만 skip + 안내 log', async () => {
    const mockFs = makeMockFs();
    const mockExec = makeMockExec();
    const logs = [];
    const r = await installSystemdUnit(INPUT, {
      fsImpl: mockFs.fs,
      execImpl: mockExec.impl,
      env: { HOME: '/home/test' }, // USER 부재.
      log: (m) => logs.push(m),
    });
    assert.equal(r.status, 'installed');
    // loginctl 호출 부재.
    assert.equal(
      mockExec.calls.some((c) => c.cmd === 'loginctl'),
      false,
    );
    assert.ok(logs.some((l) => l.includes('USER 환경변수가 비어 있어')));
  });

  it('nodeBinPath 공백 포함 → status skipped + manual fallback 안내', async () => {
    const r = await installSystemdUnit(
      { ...INPUT, nodeBinPath: '/path with space/node' },
      { fsImpl: makeMockFs().fs, execImpl: makeMockExec().impl, env: { HOME: '/h', USER: 'u' } },
    );
    assert.equal(r.status, 'skipped');
    assert.match(r.message, /공백 또는 특수문자/);
  });

  it('cliScriptPath XML 특수문자 포함 → status skipped', async () => {
    const r = await installSystemdUnit(
      { ...INPUT, cliScriptPath: '/cli/<bin>/token-weather.js' },
      { fsImpl: makeMockFs().fs, execImpl: makeMockExec().impl, env: { HOME: '/h', USER: 'u' } },
    );
    assert.equal(r.status, 'skipped');
  });

  it('overwrite 동의 + daemon-reload 실패 → 기존 content 가 restore (PR #140 review 3)', async () => {
    const servicePath = '/home/test/.config/systemd/user/token-weather-bot.service';
    const originalContent = '[Unit]\nDescription=user-original\n';
    const mockFs = makeMockFs({ files: new Map([[servicePath, originalContent]]) });
    const callCounts = { systemctl: 0 };
    const r = await installSystemdUnit(INPUT, {
      fsImpl: mockFs.fs,
      execImpl: (cmd) => {
        if (cmd === 'systemctl') {
          callCounts.systemctl += 1;
          if (callCounts.systemctl === 1) return ''; // --version ok
          throw new Error('daemon-reload failed'); // 그 다음 명령 fail.
        }
        return '';
      },
      confirmFn: async () => true, // 사용자가 overwrite 허용.
      env: { HOME: '/home/test', USER: 'test' },
    });
    assert.equal(r.status, 'failed');
    // restore 단언 — 파일이 원본 content 로 복원.
    assert.equal(mockFs.files.get(servicePath), originalContent);
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

  it('기존 task 존재 + confirm n → status skipped (PR #140 review blocker 2)', async () => {
    // schtasks /? 와 /Query 둘 다 성공 (task 존재 의미).
    let confirmAsked = false;
    const r = await installTaskScheduler(INPUT, {
      execImpl: () => '', // 모든 호출 ok — /? 통과 + /Query 통과 = 기존 task 존재.
      confirmFn: async (_q, _default) => {
        confirmAsked = true;
        return false; // n.
      },
    });
    assert.equal(confirmAsked, true);
    assert.equal(r.status, 'skipped');
    assert.match(r.message, /덮어쓰기 거부/);
  });

  it('기존 task 없음 (/Query fail) → 정상 install 진행', async () => {
    const calls = [];
    let queryCalled = 0;
    const r = await installTaskScheduler(INPUT, {
      execImpl: (cmd, args) => {
        calls.push({ cmd, args });
        if (cmd === 'schtasks' && args[0] === '/Query') {
          queryCalled += 1;
          throw new Error('task not found');
        }
        return '';
      },
    });
    assert.equal(queryCalled, 1);
    assert.equal(r.status, 'installed');
    // /Create 호출 단언.
    assert.ok(calls.some((c) => c.cmd === 'schtasks' && c.args.includes('/Create')));
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
