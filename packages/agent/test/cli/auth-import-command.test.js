import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runAuthImportCommand, formatAuthImportHelp } from '../../src/cli/auth-import-command.js';
import { runCli } from '../../src/cli/run-cli.js';
import { createEmptyAuthStore } from '../../src/auth/auth-store-schema.js';

async function captureOutput(fn) {
  const lines = [];
  const orig = console.log;
  console.log = (...args) => lines.push(args.map(String).join(' '));
  try {
    await fn();
  } finally {
    console.log = orig;
  }
  return lines;
}

describe('formatAuthImportHelp', () => {
  it('first line is auth import usage', () => {
    assert.match(formatAuthImportHelp()[0], /^token-weather auth import/);
  });

  it('mentions --help flag', () => {
    assert.match(formatAuthImportHelp().join('\n'), /-h, --help/);
  });
});

describe('runAuthImportCommand — --help', () => {
  it('prints help when provider is "--help"', async () => {
    const lines = await captureOutput(() => runAuthImportCommand('--help'));
    assert.match(lines[0], /^token-weather auth import/);
  });

  it('prints help when --help is in args (e.g. after provider)', async () => {
    const lines = await captureOutput(() => runAuthImportCommand('claude', ['--help']));
    assert.match(lines[0], /^token-weather auth import/);
  });
});

describe('runAuthImportCommand', () => {
  it('shows guidance and does not save when no selectedAccount exists', async () => {
    let saved = false;
    const lines = await captureOutput(() =>
      runAuthImportCommand('claude', [], {
        claudeReadFn: () => null,
        loadStore: async () => createEmptyAuthStore(),
        saveStore: async () => { saved = true; },
      })
    );

    const flat = lines.join('\n');
    assert.ok(flat.includes('Claude 계정을 찾을 수 없습니다.'));
    assert.equal(saved, false);
  });

  it('saves store and prints imported account summary when selectedAccount exists', async () => {
    let savedStore = null;
    const lines = await captureOutput(() =>
      runAuthImportCommand('claude', [], {
        claudeReadFn: () => ({ accessToken: 'tok', refreshToken: 'ref' }),
        loadStore: async () => createEmptyAuthStore(),
        saveStore: async (store) => { savedStore = store; },
      })
    );

    const flat = lines.join('\n');
    assert.ok(flat.includes('Claude 계정을 auth store에 저장했습니다.'));
    assert.ok(flat.includes('claude-cli-import'));
    assert.ok(savedStore);
    const account = savedStore.providers.claude.accounts[0];
    assert.equal(account.provider, 'claude');
    assert.equal(account.accountKey, 'claude-cli-import');
    assert.equal(account.source, 'claude-cli-import');
    assert.equal(account.authType, 'oauth');
  });

  it('shows provider guidance for unsupported providers', async () => {
    const lines = await captureOutput(() => runAuthImportCommand('codex'));
    assert.ok(lines.join('\n').includes('현재 claude만 지원합니다'));
  });
});

describe('runCli auth import wiring', () => {
  it('routes auth import command and shows usage/provider guidance when provider missing', async () => {
    const lines = await captureOutput(() => runCli(['auth', 'import']));
    const flat = lines.join('\n');
    assert.ok(flat.includes('사용법: token-weather auth import <provider>'));
    assert.ok(flat.includes('현재 지원 provider: claude'));
  });
});
