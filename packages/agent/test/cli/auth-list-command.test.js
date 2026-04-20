import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatClaudeImportEntry,
  runAuthListCommand,
} from '../../src/cli/auth-list-command.js';

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

describe('formatClaudeImportEntry', () => {
  const FAKE_PATH = '/home/user/.claude/.credentials.json';

  it('provider line contains "claude"', () => {
    const lines = formatClaudeImportEntry({
      authSource: 'claude-cli-import',
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
    });
    assert.ok(lines.some((l) => l.includes('provider') && l.includes('claude')));
  });

  it('source line contains "claude-cli-import"', () => {
    const lines = formatClaudeImportEntry({
      authSource: 'claude-cli-import',
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
    });
    assert.ok(lines.some((l) => l.includes('source') && l.includes('claude-cli-import')));
  });

  it('credentialsPath is included in output', () => {
    const lines = formatClaudeImportEntry({
      authSource: 'claude-cli-import',
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
    });
    assert.ok(lines.some((l) => l.includes(FAKE_PATH)));
  });

  it('reflects found/usable values', () => {
    const lines = formatClaudeImportEntry({
      authSource: 'claude-cli-import',
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
    });
    assert.ok(lines.some((l) => l.includes('found') && l.includes('false')));
    assert.ok(lines.some((l) => l.includes('usable') && l.includes('false')));
  });

  it('shows accountKey from selectedAccount when present', () => {
    const lines = formatClaudeImportEntry({
      authSource: 'claude-cli-import',
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      selectedAccount: { accountKey: 'claude-cli-import', provider: 'claude' },
    });
    assert.ok(lines.some((l) => l.includes('accountKey') && l.includes('claude-cli-import')));
  });

  it('shows (없음) for accountKey when selectedAccount is null', () => {
    const lines = formatClaudeImportEntry({
      authSource: 'not-found',
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
      selectedAccount: null,
    });
    assert.ok(lines.some((l) => l.includes('accountKey') && l.includes('없음')));
  });

  it('shows authType from selectedAccount when present', () => {
    const lines = formatClaudeImportEntry({
      authSource: 'claude-cli-import',
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      selectedAccount: { accountKey: 'claude-cli-import', provider: 'claude', authType: 'oauth' },
    });
    assert.ok(lines.some((l) => l.includes('authType') && l.includes('oauth')));
  });

  it('shows (알 수 없음) for authType when selectedAccount is null', () => {
    const lines = formatClaudeImportEntry({
      authSource: 'not-found',
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
      selectedAccount: null,
    });
    assert.ok(lines.some((l) => l.includes('authType') && l.includes('알 수 없음')));
  });
});

describe('runAuthListCommand — Claude import block', () => {
  const emptyStore = async () => ({ providers: {} });

  it('outputs Claude import block even when store has no accounts', async () => {
    const lines = await captureOutput(() =>
      runAuthListCommand(undefined, { claudeReadFn: () => null, loadStore: emptyStore })
    );
    const flat = lines.join('\n');
    assert.ok(flat.includes('claude'));
    assert.ok(flat.includes('accountKey'));
    assert.ok(flat.includes('credentialsPath'));
  });

  it('shows found=false when claudeReadFn returns null', async () => {
    const lines = await captureOutput(() =>
      runAuthListCommand('claude', { claudeReadFn: () => null, loadStore: emptyStore })
    );
    const flat = lines.join('\n');
    assert.ok(flat.includes('found'));
    assert.ok(flat.includes('false'));
  });

  it('shows found=true when claudeReadFn returns credentials', async () => {
    const lines = await captureOutput(() =>
      runAuthListCommand('claude', {
        claudeReadFn: () => ({ accessToken: 'tok', refreshToken: 'ref' }),
        loadStore: emptyStore,
      })
    );
    const flat = lines.join('\n');
    assert.ok(flat.includes('found'));
    assert.ok(flat.includes('true'));
  });

  it('shows displayName as name column when present', async () => {
    const storeWithClaude = async () => ({
      providers: {
        claude: {
          accounts: [{
            accountKey: 'anthropic-claude:acct-123',
            email: 'everdigm.itteam@gmail.com',
            displayName: '에버다임 IT팀',
            authType: 'oauth',
            source: 'agent-store',
            raw: {},
            tokens: { refreshToken: 'rt' },
          }],
        },
      },
    });
    const lines = await captureOutput(() =>
      runAuthListCommand('claude', {
        claudeReadFn: () => null,
        loadStore: storeWithClaude,
      })
    );
    const flat = lines.join('\n');
    assert.ok(flat.includes('name       : 에버다임 IT팀'));
  });

  it('authSource reflects agent-store when store has Claude accounts', async () => {
    const storeWithClaude = async () => ({
      providers: {
        claude: {
          accounts: [{ accountKey: 'claude-store', authType: 'apikey', source: 'agent-store' }],
        },
      },
    });
    const lines = await captureOutput(() =>
      runAuthListCommand('claude', {
        claudeReadFn: () => null,
        loadStore: storeWithClaude,
      })
    );
    const flat = lines.join('\n');
    assert.ok(flat.includes('agent-store'));
  });
});
