import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSetupSubcommand, formatTelegramSetupHelp } from '../src/setup-subcommand.js';

function makeLogger() {
  const logs = [];
  const errors = [];
  return {
    logs,
    errors,
    log: (m) => logs.push(m),
    errorLog: (m) => errors.push(m),
  };
}

function makeMockFs(initial = {}, { chmodThrows = false } = {}) {
  const files = new Map();
  for (const [k, v] of Object.entries(initial)) files.set(k, v);
  let chmodCalls = [];
  return {
    fs: {
      existsSync: (p) => files.has(p),
      readFileSync: (p) => {
        if (!files.has(p)) throw new Error(`mock fs: ${p} not found`);
        return files.get(p);
      },
      writeFileSync: (p, content) => {
        files.set(p, content);
      },
      mkdirSync: () => {},
      chmodSync: (p, mode) => {
        if (chmodThrows) throw new Error('EPERM: chmod not supported');
        chmodCalls.push({ path: p, mode });
      },
      statSync: (p) => {
        if (!files.has(p)) throw new Error('not found');
        return { mode: 0o100600 };
      },
    },
    files,
    chmodCalls: () => chmodCalls,
  };
}

function makeMockBot() {
  let messageHandler = null;
  let stopped = false;
  return {
    bot: {
      init: async () => {},
      on: (event, handler) => {
        if (event === 'message:text') messageHandler = handler;
      },
      catch: () => {},
      start: () => new Promise(() => {}),
      stop: async () => {
        stopped = true;
      },
    },
    fire: async (ctx) => messageHandler(ctx),
    stopped: () => stopped,
  };
}

describe('runSetupSubcommand (Phase 4)', () => {
  it('--help 는 throw 없이 안내 출력', async () => {
    const { logs, log, errorLog } = makeLogger();
    await runSetupSubcommand(
      ['--help'],
      { resolveAgentConfigPath: () => '/cfg' },
      { log, errorLog },
    );
    assert.ok(logs.some((l) => l.includes('telegram setup')));
  });

  it('빈 토큰 입력 시 친화 에러 + exit 1', async () => {
    process.exitCode = 0;
    const { errors, log, errorLog } = makeLogger();
    await runSetupSubcommand(
      [],
      { resolveAgentConfigPath: () => '/cfg' },
      {
        promptFn: async () => '',
        log,
        errorLog,
      },
    );
    assert.ok(errors.some((e) => e.includes('빈 토큰')));
    assert.equal(process.exitCode, 1);
    process.exitCode = 0;
  });

  it('getMe 실패 시 친화 에러 + exit 1', async () => {
    process.exitCode = 0;
    const { errors, log, errorLog } = makeLogger();
    await runSetupSubcommand(
      [],
      { resolveAgentConfigPath: () => '/cfg' },
      {
        promptFn: async () => '123:bad',
        fetchFn: async () => ({
          status: 401,
          json: async () => ({ ok: false, description: 'Unauthorized' }),
        }),
        log,
        errorLog,
      },
    );
    assert.ok(errors.some((e) => e.includes('토큰 검증 실패')));
    assert.equal(process.exitCode, 1);
    process.exitCode = 0;
  });

  it('정상 흐름 — 페어링 성공 → config write + chmod 600 + template print', async () => {
    process.exitCode = 0;
    const { logs, log, errorLog } = makeLogger();
    const mockFs = makeMockFs();
    const mock = makeMockBot();
    const setupPromise = runSetupSubcommand(
      [],
      {
        resolveAgentConfigPath: () => '/test/config.json',
        cliScriptPath: '/cli/bin',
        createDefaultConfig: () => ({
          version: 1,
          providers: { codex: { enabled: true }, claude: { enabled: true } },
        }),
      },
      {
        promptFn: async () => '123:fake',
        fetchFn: async () => ({
          status: 200,
          json: async () => ({ ok: true, result: { username: 'MyBot' } }),
        }),
        botFactory: () => mock.bot,
        fsImpl: mockFs.fs,
        log,
        errorLog,
      },
    );

    // pairing 시작까지 yield.
    await new Promise((r) => setImmediate(r));
    // /pair 메시지 발사.
    const replies = [];
    await mock.fire({
      message: {
        text: `/pair ${logs.find((l) => l.includes('/pair'))?.match(/\/pair (\S+)/)?.[1]}`,
      },
      from: { id: 42, username: 'alice' },
      reply: async (m) => replies.push(m),
    });
    await setupPromise;

    // config 파일 작성됨.
    const written = mockFs.files.get('/test/config.json');
    assert.ok(written, 'config 파일이 작성되어야 함');
    const parsed = JSON.parse(written);
    assert.equal(parsed.channels.telegram.enabled, true);
    assert.equal(parsed.channels.telegram.botToken, '123:fake');
    assert.deepEqual(parsed.channels.telegram.allowedUserIds, [42]);
    // PR #135 review — default config 기반이라 providers 도 채워짐 (setup 직후
    // status/usage 가 disabled 가 아님).
    assert.equal(parsed.providers.codex.enabled, true);
    assert.equal(parsed.providers.claude.enabled, true);
    assert.equal(parsed.version, 1);
    // chmod 600 호출됨.
    const chmods = mockFs.chmodCalls();
    assert.equal(chmods.length, 1);
    assert.equal(chmods[0].mode, 0o600);
    // template 안내 포함.
    const out = logs.join('\n');
    assert.match(out, /부팅 후 자동 시작/);
    assert.match(out, /token-weather telegram start/);
    // deep link URL 안내 포함 (issue #137) — t.me/<botUsername>?start=<code> 패턴.
    assert.match(out, /https:\/\/t\.me\/MyBot\?start=TGW-/);
    // 기존 수동 /pair <code> 안내도 보존 (backward-compat).
    assert.match(out, /\/pair TGW-/);
    assert.equal(process.exitCode, 0);
  });

  it('chmod 실패 시 안내 메시지 정합 (PR #135 review)', async () => {
    process.exitCode = 0;
    const { logs, errors, log, errorLog } = makeLogger();
    const mockFs = makeMockFs({}, { chmodThrows: true });
    const mock = makeMockBot();
    const setupPromise = runSetupSubcommand(
      [],
      {
        resolveAgentConfigPath: () => '/test/config.json',
        createDefaultConfig: () => ({ version: 1, providers: {} }),
      },
      {
        promptFn: async () => '123:fake',
        fetchFn: async () => ({
          status: 200,
          json: async () => ({ ok: true, result: { username: 'B' } }),
        }),
        botFactory: () => mock.bot,
        fsImpl: mockFs.fs,
        log,
        errorLog,
      },
    );
    await new Promise((r) => setImmediate(r));
    await mock.fire({
      message: {
        text: `/pair ${logs.find((l) => l.includes('/pair'))?.match(/\/pair (\S+)/)?.[1]}`,
      },
      from: { id: 7 },
      reply: async () => {},
    });
    await setupPromise;
    // chmod 실패 warning + 저장 메시지가 `(chmod 미적용 — ...)` 표기.
    assert.ok(errors.some((e) => e.includes('chmod 600 적용 실패')));
    assert.ok(logs.some((l) => l.includes('chmod 미적용')));
    assert.equal(
      logs.some((l) => l.includes('(chmod 600)')),
      false,
      'chmod 실패 시 (chmod 600) 표기 금지',
    );
  });

  it('기존 config 의 다른 키 보존 + channels.telegram 만 갱신', async () => {
    process.exitCode = 0;
    const { logs, log, errorLog } = makeLogger();
    const existing = {
      version: 1,
      providers: { codex: { enabled: true } },
      channels: { telegram: { enabled: false, botToken: '', allowedUserIds: [] } },
    };
    const mockFs = makeMockFs({ '/test/config.json': JSON.stringify(existing) });
    const mock = makeMockBot();
    const setupPromise = runSetupSubcommand(
      [],
      { resolveAgentConfigPath: () => '/test/config.json' },
      {
        promptFn: async () => '123:fake',
        fetchFn: async () => ({
          status: 200,
          json: async () => ({ ok: true, result: { username: 'B' } }),
        }),
        botFactory: () => mock.bot,
        fsImpl: mockFs.fs,
        log,
        errorLog,
      },
    );
    await new Promise((r) => setImmediate(r));
    await mock.fire({
      message: {
        text: `/pair ${logs.find((l) => l.includes('/pair'))?.match(/\/pair (\S+)/)?.[1]}`,
      },
      from: { id: 99 },
      reply: async () => {},
    });
    await setupPromise;
    const parsed = JSON.parse(mockFs.files.get('/test/config.json'));
    assert.equal(parsed.version, 1, 'version 보존');
    assert.deepEqual(parsed.providers, { codex: { enabled: true } }, 'providers 보존');
    assert.equal(parsed.channels.telegram.enabled, true, 'telegram 갱신됨');
  });
});

describe('formatTelegramSetupHelp', () => {
  it('첫 줄이 token-weather telegram setup', () => {
    assert.match(formatTelegramSetupHelp()[0], /^token-weather telegram setup$/);
  });
  it('6 단계 흐름 안내 포함', () => {
    const text = formatTelegramSetupHelp().join('\n');
    assert.match(text, /1\. BotFather/);
    assert.match(text, /5\. OS 별 service template/);
  });
});
