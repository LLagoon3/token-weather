import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runAuthLogoutCommand, formatAuthLogoutHelp } from '../../src/cli/auth-logout-command.js';
import { saveAuthStore } from '../../src/auth/auth-store.js';
import { createEmptyAuthStore } from '../../src/auth/auth-store-schema.js';

let tmpHome;
let originalHome;
let originalLog;
let originalErr;
let logs;
let errs;

function withTmpHome() {
  before(() => {
    originalHome = process.env.HOME;
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-usage-logout-'));
    process.env.HOME = tmpHome;
    originalLog = console.log;
    originalErr = console.error;
    logs = [];
    errs = [];
    console.log = (...a) => logs.push(a.join(' '));
    console.error = (...a) => errs.push(a.join(' '));
    process.exitCode = 0;
  });
  after(() => {
    console.log = originalLog;
    console.error = originalErr;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
    process.exitCode = 0;
  });
}

async function seedStore(providers = {}) {
  const store = createEmptyAuthStore();
  store.providers = providers;
  await saveAuthStore(store);
}

describe('formatAuthLogoutHelp', () => {
  it('first line is auth logout usage', () => {
    assert.match(formatAuthLogoutHelp()[0], /^token-weather auth logout/);
  });

  it('lists --account and --help', () => {
    const body = formatAuthLogoutHelp().join('\n');
    assert.match(body, /--account/);
    assert.match(body, /-h, --help/);
  });
});

describe('runAuthLogoutCommand — --help', () => {
  withTmpHome();

  it('prints help before provider validation when --help is in args', async () => {
    await runAuthLogoutCommand(undefined, ['--help']);
    assert.ok(logs.some((l) => l.startsWith('token-weather auth logout')));
    // --help 경로는 exit 1을 설정하지 않는다.
    assert.notEqual(process.exitCode, 1);
  });

  it('prints help when --help is in the provider slot (auth logout --help)', async () => {
    // runCli가 provider='--help', args=[]로 전달하는 경로.
    logs.length = 0;
    process.exitCode = 0;
    await runAuthLogoutCommand('--help', []);
    assert.ok(logs.some((l) => l.startsWith('token-weather auth logout')));
    assert.notEqual(process.exitCode, 1);
  });

  it('also honors -h in the provider slot', async () => {
    logs.length = 0;
    process.exitCode = 0;
    await runAuthLogoutCommand('-h', []);
    assert.ok(logs.some((l) => l.startsWith('token-weather auth logout')));
    assert.notEqual(process.exitCode, 1);
  });
});

describe('runAuthLogoutCommand — usage error', () => {
  withTmpHome();

  it('prints usage to stderr and sets exitCode=1 when provider missing', async () => {
    await runAuthLogoutCommand(undefined, []);
    assert.ok(errs.some((l) => l.includes('사용법: token-weather auth logout')));
    assert.equal(process.exitCode, 1);
  });
});

describe('runAuthLogoutCommand — no accounts stored', () => {
  withTmpHome();

  it('reports 저장된 계정이 없습니다 when provider entry missing', async () => {
    await saveAuthStore(createEmptyAuthStore());
    await runAuthLogoutCommand('openai-codex', []);
    assert.ok(logs.some((l) => l.includes('저장된 계정이 없습니다')));
  });
});

describe('runAuthLogoutCommand — single account removal', () => {
  withTmpHome();

  it('removes the only account and logs removal details', async () => {
    await seedStore({
      'openai-codex': {
        accounts: [
          {
            accountKey: 'openai-codex:alice',
            email: 'alice@example.com',
            source: 'agent-store',
            authType: 'oauth',
            status: 'active',
            tokens: { accessToken: 'real-tok' },
          },
        ],
      },
    });

    await runAuthLogoutCommand('openai-codex', []);

    assert.ok(logs.some((l) => l.includes('제거 대상')));
    assert.ok(logs.some((l) => l.includes('openai-codex:alice')));
    assert.ok(logs.some((l) => l.includes('계정이 로컬 저장소에서 제거되었습니다')));
  });
});

describe('runAuthLogoutCommand — --account selection', () => {
  withTmpHome();

  it('removes the account matching --account email', async () => {
    await seedStore({
      'openai-codex': {
        accounts: [
          {
            accountKey: 'openai-codex:a',
            email: 'a@x.com',
            source: 'agent-store',
            authType: 'oauth',
            status: 'active',
            tokens: { accessToken: 't1' },
          },
          {
            accountKey: 'openai-codex:b',
            email: 'b@x.com',
            source: 'agent-store',
            authType: 'oauth',
            status: 'active',
            tokens: { accessToken: 't2' },
          },
        ],
      },
    });

    await runAuthLogoutCommand('openai-codex', ['--account', 'b@x.com']);

    assert.ok(logs.some((l) => l.includes('openai-codex:b')));
    assert.ok(!logs.some((l) => l.includes('제거 대상') && l.includes('a@x.com')));
  });

  it('reports not-found when --account does not match any account', async () => {
    await seedStore({
      'openai-codex': {
        accounts: [
          {
            accountKey: 'openai-codex:a',
            email: 'a@x.com',
            source: 'agent-store',
            authType: 'oauth',
            status: 'active',
            tokens: { accessToken: 't1' },
          },
        ],
      },
    });

    await runAuthLogoutCommand('openai-codex', ['--account', 'nope@x.com']);
    assert.ok(logs.some((l) => l.includes('계정을 찾을 수 없습니다')));
    assert.equal(process.exitCode, 1);
  });
});
