import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  selectCodexAuthSource,
  filterRealCodexAccounts,
  buildClaudeSnapshot,
  selectClaudeAuthSource,
  resolveClaudeProfileFromSnapshot,
} from '../../src/services/status-service.js';

// ---------------------------------------------------------------------------
// filterRealCodexAccounts
// ---------------------------------------------------------------------------

describe('filterRealCodexAccounts', () => {
  it('keeps an active account with a real access token', () => {
    const accounts = [
      {
        accountKey: 'codex:alice',
        status: 'active',
        tokens: { accessToken: 'real-token-abc' },
      },
    ];
    const result = filterRealCodexAccounts(accounts);
    assert.equal(result.length, 1);
    assert.equal(result[0].accountKey, 'codex:alice');
  });

  it('excludes accounts whose accessToken starts with "mock-"', () => {
    const accounts = [
      {
        accountKey: 'codex:mock-user',
        status: 'active',
        tokens: { accessToken: 'mock-token-xyz' },
      },
    ];
    assert.equal(filterRealCodexAccounts(accounts).length, 0);
  });

  it('excludes accounts with raw.mock set to true', () => {
    const accounts = [
      {
        accountKey: 'codex:mock-flagged',
        status: 'active',
        tokens: { accessToken: 'some-token' },
        raw: { mock: true },
      },
    ];
    assert.equal(filterRealCodexAccounts(accounts).length, 0);
  });

  it('excludes disabled accounts even with a real token', () => {
    const accounts = [
      {
        accountKey: 'codex:disabled',
        status: 'disabled',
        tokens: { accessToken: 'real-token' },
      },
    ];
    assert.equal(filterRealCodexAccounts(accounts).length, 0);
  });

  it('excludes accounts with no accessToken', () => {
    const accounts = [{ accountKey: 'codex:no-token', status: 'active', tokens: {} }];
    assert.equal(filterRealCodexAccounts(accounts).length, 0);
  });

  it('handles null/undefined gracefully', () => {
    assert.equal(filterRealCodexAccounts(null).length, 0);
    assert.equal(filterRealCodexAccounts(undefined).length, 0);
  });

  it('returns only real accounts when mixed with mock ones', () => {
    const accounts = [
      { accountKey: 'codex:real', status: 'active', tokens: { accessToken: 'real-token' } },
      { accountKey: 'codex:mock', status: 'active', tokens: { accessToken: 'mock-token' } },
      { accountKey: 'codex:flagged', status: 'active', tokens: { accessToken: 'token' }, raw: { mock: true } },
    ];
    const result = filterRealCodexAccounts(accounts);
    assert.equal(result.length, 1);
    assert.equal(result[0].accountKey, 'codex:real');
  });
});

// ---------------------------------------------------------------------------
// selectCodexAuthSource — auth source selection priority
// ---------------------------------------------------------------------------

describe('selectCodexAuthSource', () => {
  const agentProfile = { id: 'codex:alice', accessToken: 'real-token' };
  const openclawProfile = { id: 'openclaw-profile', accessToken: 'oc-token' };

  it('uses agent-store when real agent profiles exist', () => {
    const result = selectCodexAuthSource([agentProfile], [openclawProfile]);
    assert.equal(result.authSource, 'agent-store');
    assert.deepStrictEqual(result.profiles, [agentProfile]);
  });

  it('falls back to openclaw-import when agent profiles list is empty', () => {
    const result = selectCodexAuthSource([], [openclawProfile]);
    assert.equal(result.authSource, 'openclaw-import');
    assert.deepStrictEqual(result.profiles, [openclawProfile]);
  });

  it('returns openclaw-import with empty profiles when both lists are empty', () => {
    const result = selectCodexAuthSource([], []);
    assert.equal(result.authSource, 'openclaw-import');
    assert.equal(result.profiles.length, 0);
  });
});

// ---------------------------------------------------------------------------
// selectClaudeAuthSource — Claude auth source priority
// ---------------------------------------------------------------------------

describe('selectClaudeAuthSource', () => {
  const fakeCredential = { accessToken: 'tok', refreshToken: 'ref' };
  const fakeAgentAccount = { accountKey: 'claude:alice', status: 'active' };

  it('returns agent-store when agent-store accounts exist', () => {
    assert.equal(selectClaudeAuthSource([fakeAgentAccount], fakeCredential), 'agent-store');
  });

  it('returns agent-store even when imported credential is null', () => {
    assert.equal(selectClaudeAuthSource([fakeAgentAccount], null), 'agent-store');
  });

  it('returns claude-cli-import when no agent accounts but credential is present', () => {
    assert.equal(selectClaudeAuthSource([], fakeCredential), 'claude-cli-import');
  });

  it('returns not-found when both agent accounts and credential are absent', () => {
    assert.equal(selectClaudeAuthSource([], null), 'not-found');
  });

  it('returns not-found when agentAccounts is null and credential is null', () => {
    assert.equal(selectClaudeAuthSource(null, null), 'not-found');
  });
});

// ---------------------------------------------------------------------------
// buildClaudeSnapshot — Claude credential detection
// ---------------------------------------------------------------------------

describe('buildClaudeSnapshot', () => {
  const FAKE_PATH = '/home/user/.claude/.credentials.json';

  it('returns detected=true and authSource=claude-cli-import when credentials are found', () => {
    const fakeCredentials = { accessToken: 'tok', refreshToken: 'ref', expiresAt: null, scopes: [], subscriptionType: null, rateLimitTier: null };
    const result = buildClaudeSnapshot(FAKE_PATH, () => fakeCredentials);
    assert.equal(result.detected, true);
    assert.equal(result.authSource, 'claude-cli-import');
    assert.equal(result.found, true);
    assert.equal(result.parsed, true);
    assert.equal(result.credentialsPath, FAKE_PATH);
  });

  it('returns detected=false and authSource=not-found when credentials are not found', () => {
    const result = buildClaudeSnapshot(FAKE_PATH, () => null);
    assert.equal(result.detected, false);
    assert.equal(result.found, false);
    assert.equal(result.parsed, false);
    assert.equal(result.authSource, 'not-found');
  });

  it('always includes credentialsPath in the snapshot', () => {
    const result = buildClaudeSnapshot(FAKE_PATH, () => null);
    assert.equal(result.credentialsPath, FAKE_PATH);
  });

  it('includes selectedAccount with accountKey when credentials are found', () => {
    const fakeCredentials = { accessToken: 'tok', refreshToken: 'ref', expiresAt: null, scopes: [], subscriptionType: null, rateLimitTier: null };
    const result = buildClaudeSnapshot(FAKE_PATH, () => fakeCredentials);
    assert.ok(result.selectedAccount !== null, 'selectedAccount should not be null');
    assert.equal(result.selectedAccount.accountKey, 'claude-cli-import');
    assert.equal(result.selectedAccount.provider, 'claude');
    assert.equal(result.selectedAccount.source, 'claude-cli-import');
  });

  it('importedAccount is a backward-compat alias for selectedAccount', () => {
    const fakeCredentials = { accessToken: 'tok', refreshToken: 'ref', expiresAt: null, scopes: [], subscriptionType: null, rateLimitTier: null };
    const result = buildClaudeSnapshot(FAKE_PATH, () => fakeCredentials);
    assert.equal(result.importedAccount, result.selectedAccount);
  });

  it('sets selectedAccount to null when credentials are not found', () => {
    const result = buildClaudeSnapshot(FAKE_PATH, () => null);
    assert.equal(result.selectedAccount, null);
  });

  it('importedAccount alias is also null when credentials are not found', () => {
    const result = buildClaudeSnapshot(FAKE_PATH, () => null);
    assert.equal(result.importedAccount, null);
  });

  it('uses agent-store authSource when agentClaudeAccounts are provided', () => {
    const fakeCredentials = { accessToken: 'tok', refreshToken: 'ref', expiresAt: null, scopes: [], subscriptionType: null, rateLimitTier: null };
    const fakeAgentAccount = { accountKey: 'claude:alice', source: 'agent-store' };
    const result = buildClaudeSnapshot(FAKE_PATH, () => fakeCredentials, [fakeAgentAccount]);
    assert.equal(result.authSource, 'agent-store');
    assert.equal(result.detected, true);
  });

  it('resolveClaudeAccount selects the agent-store account as selectedAccount when agent accounts provided', () => {
    const fakeCredentials = { accessToken: 'tok', refreshToken: 'ref', expiresAt: null, scopes: [], subscriptionType: null, rateLimitTier: null };
    const fakeAgentAccount = { accountKey: 'claude:alice', provider: 'claude', source: 'agent-store', status: 'active' };
    const result = buildClaudeSnapshot(FAKE_PATH, () => fakeCredentials, [fakeAgentAccount]);
    assert.equal(result.authSource, 'agent-store');
    assert.equal(result.selectedAccount?.accountKey, 'claude:alice');
    assert.equal(result.importedAccount?.accountKey, 'claude:alice'); // alias check
  });

  it('includes usage from stats-cache when available', () => {
    const fakeStatsCache = {
      version: 3,
      totalSessions: 10,
      totalMessages: 200,
      hasModelUsage: true,
      hasDailyModelTokens: false,
      raw: {},
    };
    const result = buildClaudeSnapshot(FAKE_PATH, () => null, [], '/fake/stats-cache.json', () => fakeStatsCache);
    assert.equal(result.usage.source, 'stats-cache-json');
    assert.equal(result.usage.totalSessions, 10);
    assert.equal(result.usage.totalMessages, 200);
    assert.equal(result.usage.hasModelUsage, true);
    assert.equal(result.usage.hasDailyModelTokens, false);
  });

  it('includes usage.source=not-found when stats-cache is unavailable', () => {
    const result = buildClaudeSnapshot(FAKE_PATH, () => null, [], '/fake/stats-cache.json', () => null);
    assert.equal(result.usage.source, 'not-found');
  });
});

// ---------------------------------------------------------------------------
// resolveClaudeProfileFromSnapshot — extract usage profile from Claude snapshot
// ---------------------------------------------------------------------------

describe('resolveClaudeProfileFromSnapshot', () => {
  it('returns null when selectedAccount is absent', () => {
    assert.equal(resolveClaudeProfileFromSnapshot({ selectedAccount: null }), null);
    assert.equal(resolveClaudeProfileFromSnapshot({}), null);
    assert.equal(resolveClaudeProfileFromSnapshot(null), null);
  });

  it('returns null when selectedAccount has no accessToken anywhere', () => {
    const snapshot = { selectedAccount: { accountKey: 'claude-cli-import' } };
    assert.equal(resolveClaudeProfileFromSnapshot(snapshot), null);
  });

  it('extracts accessToken from top-level (claude-cli-import shape)', () => {
    const snapshot = {
      selectedAccount: {
        accountKey: 'claude-cli-import',
        accessToken: 'sk-ant-import-token',
        email: 'user@example.com',
      },
    };
    const profile = resolveClaudeProfileFromSnapshot(snapshot);
    assert.equal(profile.id, 'claude-cli-import');
    assert.equal(profile.accessToken, 'sk-ant-import-token');
    assert.equal(profile.email, 'user@example.com');
  });

  it('extracts accessToken from tokens.accessToken (agent-store shape)', () => {
    const snapshot = {
      selectedAccount: {
        accountKey: 'claude:alice',
        tokens: { accessToken: 'sk-ant-store-token' },
        accountId: 'acc-42',
      },
    };
    const profile = resolveClaudeProfileFromSnapshot(snapshot);
    assert.equal(profile.id, 'claude:alice');
    assert.equal(profile.accessToken, 'sk-ant-store-token');
    assert.equal(profile.accountId, 'acc-42');
  });
});
