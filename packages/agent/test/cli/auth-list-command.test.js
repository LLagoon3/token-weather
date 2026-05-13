import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatClaudeImportEntry,
  formatAuthListHelp,
  runAuthListCommand,
  collectAuthListData,
  formatAuthListLines,
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

describe('formatAuthListHelp', () => {
  it('first line is auth list usage', () => {
    assert.match(formatAuthListHelp()[0], /^token-weather auth list/);
  });

  it('mentions --help flag', () => {
    assert.match(formatAuthListHelp().join('\n'), /-h, --help/);
  });
});

describe('runAuthListCommand — --help', () => {
  it('prints help and exits when provider is "--help"', async () => {
    const lines = await captureOutput(() => runAuthListCommand('--help'));
    assert.match(lines[0], /^token-weather auth list/);
  });

  it('prints help when provider is "-h"', async () => {
    const lines = await captureOutput(() => runAuthListCommand('-h'));
    assert.match(lines[0], /^token-weather auth list/);
  });
});

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
      runAuthListCommand(undefined, { claudeReadFn: () => null, loadStore: emptyStore }),
    );
    const flat = lines.join('\n');
    assert.ok(flat.includes('claude'));
    assert.ok(flat.includes('accountKey'));
    assert.ok(flat.includes('credentialsPath'));
  });

  it('shows found=false when claudeReadFn returns null', async () => {
    const lines = await captureOutput(() =>
      runAuthListCommand('claude', { claudeReadFn: () => null, loadStore: emptyStore }),
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
      }),
    );
    const flat = lines.join('\n');
    assert.ok(flat.includes('found'));
    assert.ok(flat.includes('true'));
  });

  it('shows displayName as name column when present', async () => {
    const storeWithClaude = async () => ({
      providers: {
        claude: {
          accounts: [
            {
              accountKey: 'anthropic-claude:acct-123',
              email: 'everdigm.itteam@gmail.com',
              displayName: '에버다임 IT팀',
              authType: 'oauth',
              source: 'agent-store',
              raw: {},
              tokens: { refreshToken: 'rt' },
            },
          ],
        },
      },
    });
    const lines = await captureOutput(() =>
      runAuthListCommand('claude', {
        claudeReadFn: () => null,
        loadStore: storeWithClaude,
      }),
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
      }),
    );
    const flat = lines.join('\n');
    assert.ok(flat.includes('agent-store'));
  });
});

// ---------------------------------------------------------------------------
// collectAuthListData / formatAuthListLines (Phase 3 issue #128)
// ---------------------------------------------------------------------------

describe('collectAuthListData', () => {
  it('provider 지정 시 해당 provider 만 + claude import (claude 인 경우만)', async () => {
    const loadStore = async () => ({
      providers: {
        'openai-codex': { accounts: [{ accountKey: 'codex:1' }] },
        claude: { accounts: [] },
      },
    });
    const claudeReadFn = () => null;
    const data = await collectAuthListData('openai-codex', { loadStore, claudeReadFn });
    assert.deepEqual(data.providers, [
      { id: 'openai-codex', accounts: [{ accountKey: 'codex:1' }] },
    ]);
    assert.equal(data.claudeImport, null);
  });

  it('provider 미지정 시 모든 provider + claude import', async () => {
    const loadStore = async () => ({
      providers: {
        'openai-codex': { accounts: [{ accountKey: 'codex:1' }] },
        claude: { accounts: [{ accountKey: 'claude:1' }] },
      },
    });
    const claudeReadFn = () => null;
    const data = await collectAuthListData(undefined, { loadStore, claudeReadFn });
    assert.equal(data.providers.length, 2);
    assert.ok(data.claudeImport);
    assert.equal(typeof data.claudeImport.credentialsPath, 'string');
  });

  it('store 의 providers 가 없어도 안전', async () => {
    const loadStore = async () => ({});
    const data = await collectAuthListData(undefined, { loadStore, claudeReadFn: () => null });
    assert.deepEqual(data.providers, []);
  });
});

describe('formatAuthListLines', () => {
  it('계정 0 + 필터 없음 → "저장된 인증 계정이 없습니다."', () => {
    const lines = formatAuthListLines({ providers: [], claudeImport: null });
    assert.ok(lines.some((l) => l.includes('저장된 인증 계정이 없습니다')));
  });

  it('계정 0 + provider 필터 → "[pid] 저장된 계정이 없습니다."', () => {
    const lines = formatAuthListLines(
      { providers: [{ id: 'openai-codex', accounts: [] }], claudeImport: null },
      { providerFilter: 'openai-codex' },
    );
    assert.ok(lines.some((l) => l.includes('[openai-codex] 저장된 계정이 없습니다')));
  });

  it('계정 1+ → 헤더 + 계정 라인들 출력', () => {
    const lines = formatAuthListLines({
      providers: [
        {
          id: 'openai-codex',
          accounts: [
            {
              accountKey: 'codex:1',
              email: 'a@b.com',
              displayName: 'A',
              source: 'agent-store',
              status: 'active',
              tokens: { refreshToken: 'r' },
            },
          ],
        },
      ],
      claudeImport: null,
    });
    assert.ok(lines.some((l) => l.includes('── openai-codex ──')));
    assert.ok(lines.some((l) => l.includes('codex:1')));
    assert.ok(lines.some((l) => l.includes('a@b.com')));
    assert.ok(lines.some((l) => l.includes('refresh') && l.includes('available')));
  });

  it('claudeImport 가 있으면 import source 섹션 출력', () => {
    const lines = formatAuthListLines({
      providers: [],
      claudeImport: {
        selectedAccount: { accountKey: 'cli:1', authType: 'oauth' },
        found: true,
        parsed: true,
        credentialsPath: '/x/.credentials.json',
      },
    });
    assert.ok(lines.some((l) => l.includes('── claude (import source) ──')));
    assert.ok(lines.some((l) => l.includes('cli:1')));
    assert.ok(lines.some((l) => l.includes('claude-cli-import')));
  });

  it('pure — 동일 입력 동일 출력 (CLI / Telegram 공유)', () => {
    const input = {
      providers: [{ id: 'openai-codex', accounts: [] }],
      claudeImport: null,
    };
    assert.deepEqual(
      formatAuthListLines(input, { providerFilter: 'openai-codex' }),
      formatAuthListLines(input, { providerFilter: 'openai-codex' }),
    );
  });
});
