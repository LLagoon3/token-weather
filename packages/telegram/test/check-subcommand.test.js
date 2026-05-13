import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runCheckSubcommand, formatTelegramCheckHelp } from '../src/check-subcommand.js';

function makeLogger() {
  const logs = [];
  return { logs, log: (m) => logs.push(m) };
}

function makeMockFs(files, mode = 0o100600) {
  return {
    existsSync: (p) => files.has(p),
    readFileSync: (p) => {
      if (!files.has(p)) throw new Error('not found');
      return files.get(p);
    },
    statSync: () => ({ mode }),
  };
}

describe('runCheckSubcommand (Phase 4)', () => {
  it('--help 안내 출력', async () => {
    const { logs, log } = makeLogger();
    await runCheckSubcommand(['--help'], { resolveAgentConfigPath: () => '/cfg' }, { log });
    assert.ok(logs.some((l) => l.includes('telegram check')));
  });

  it('config 파일 없음 → ✗ + exit 1', async () => {
    process.exitCode = 0;
    const { log } = makeLogger();
    const r = await runCheckSubcommand(
      [],
      { resolveAgentConfigPath: () => '/cfg.json' },
      { log, fsImpl: makeMockFs(new Map()), platform: 'linux' },
    );
    assert.equal(r.checks[0].name, 'config 파일');
    assert.equal(r.checks[0].ok, false);
    assert.equal(process.exitCode, 1);
    process.exitCode = 0;
  });

  it('정상 흐름 — 모든 검사 통과', async () => {
    process.exitCode = 0;
    const { log } = makeLogger();
    const cfg = JSON.stringify({
      channels: {
        telegram: {
          enabled: true,
          botToken: '123:fake',
          allowedUserIds: [42],
        },
      },
    });
    const r = await runCheckSubcommand(
      [],
      { resolveAgentConfigPath: () => '/cfg.json' },
      {
        log,
        fsImpl: makeMockFs(new Map([['/cfg.json', cfg]])),
        fetchFn: async () => ({
          status: 200,
          json: async () => ({ ok: true, result: { username: 'TokenWeatherBot' } }),
        }),
        platform: 'darwin', // skip linger 검사.
      },
    );
    // ✗ 없음.
    assert.equal(
      r.checks.some((c) => c.ok === false),
      false,
    );
    // botToken 통과 + getMe 통과.
    assert.ok(r.checks.some((c) => c.name === 'getMe API' && c.ok === true));
    assert.equal(process.exitCode, 0);
  });

  it('chmod 권한 group/world 노출 시 warn (exit 0 유지)', async () => {
    process.exitCode = 0;
    const { log } = makeLogger();
    const cfg = JSON.stringify({
      channels: { telegram: { enabled: true, botToken: '123:fake', allowedUserIds: [42] } },
    });
    const r = await runCheckSubcommand(
      [],
      { resolveAgentConfigPath: () => '/cfg.json' },
      {
        log,
        fsImpl: makeMockFs(new Map([['/cfg.json', cfg]]), 0o100644),
        fetchFn: async () => ({
          status: 200,
          json: async () => ({ ok: true, result: { username: 'B' } }),
        }),
        platform: 'darwin',
      },
    );
    const permCheck = r.checks.find((c) => c.name === 'config 권한');
    assert.equal(permCheck.ok, 'warn');
    assert.equal(process.exitCode, 0, 'warn 은 exit code 영향 없음');
  });

  it('enabled=false 면 ✗ + exit 1', async () => {
    process.exitCode = 0;
    const { log } = makeLogger();
    const cfg = JSON.stringify({
      channels: { telegram: { enabled: false, botToken: '', allowedUserIds: [] } },
    });
    const r = await runCheckSubcommand(
      [],
      { resolveAgentConfigPath: () => '/cfg.json' },
      {
        log,
        fsImpl: makeMockFs(new Map([['/cfg.json', cfg]])),
        platform: 'darwin',
      },
    );
    assert.ok(r.checks.some((c) => c.name.includes('enabled') && c.ok === false));
    assert.equal(process.exitCode, 1);
    process.exitCode = 0;
  });

  it('Linux + linger 비활성화 시 warn', async () => {
    process.exitCode = 0;
    const { log } = makeLogger();
    const cfg = JSON.stringify({
      channels: { telegram: { enabled: true, botToken: '123:fake', allowedUserIds: [42] } },
    });
    const r = await runCheckSubcommand(
      [],
      { resolveAgentConfigPath: () => '/cfg.json' },
      {
        log,
        fsImpl: makeMockFs(new Map([['/cfg.json', cfg]])),
        fetchFn: async () => ({
          status: 200,
          json: async () => ({ ok: true, result: { username: 'B' } }),
        }),
        execImpl: () => 'Linger=no',
        platform: 'linux',
      },
    );
    const lingerCheck = r.checks.find((c) => c.name === 'systemd linger');
    assert.equal(lingerCheck.ok, 'warn');
    assert.equal(process.exitCode, 0);
  });
});

describe('formatTelegramCheckHelp', () => {
  it('첫 줄이 token-weather telegram check', () => {
    assert.match(formatTelegramCheckHelp()[0], /^token-weather telegram check$/);
  });
  it('검사 항목 목록 포함', () => {
    const text = formatTelegramCheckHelp().join('\n');
    assert.match(text, /config 파일 존재/);
    assert.match(text, /getMe/);
    assert.match(text, /linger/);
  });
});
