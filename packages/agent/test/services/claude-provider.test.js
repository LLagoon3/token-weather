import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClaudeSnapshot,
  resolveClaudeProfileFromSnapshot,
  selectClaudeAuthSource,
  getClaudeSnapshot,
  filterProfilesByAccount,
} from '../../src/services/claude-provider.js';
import { filterEntriesByAccount } from '../../src/services/account-filter.js';

const FAKE_PATH = '/tmp/fake-claude-credentials.json';

describe('selectClaudeAuthSource (via claude-provider)', () => {
  it('agent-store > claude-cli-import > not-found', () => {
    assert.equal(selectClaudeAuthSource([{ id: 'a' }], { x: true }), 'agent-store');
    assert.equal(selectClaudeAuthSource([], { x: true }), 'claude-cli-import');
    assert.equal(selectClaudeAuthSource([], null), 'not-found');
  });
});

describe('buildClaudeSnapshot (via claude-provider)', () => {
  it('returns detected=false when no credentials and no agent accounts', () => {
    const snap = buildClaudeSnapshot(FAKE_PATH, () => null, []);
    assert.equal(snap.detected, false);
    assert.equal(snap.authSource, 'not-found');
  });

  it('detects credentials from injected readFn', () => {
    const fakeCreds = {
      accessToken: 't',
      refreshToken: 'r',
      expiresAt: null,
      scopes: [],
      subscriptionType: null,
      rateLimitTier: null,
    };
    const snap = buildClaudeSnapshot(FAKE_PATH, () => fakeCreds, []);
    assert.equal(snap.detected, true);
    assert.equal(snap.authSource, 'claude-cli-import');
    assert.equal(snap.selectedAccount?.accountKey, 'claude-cli-import');
  });

  // issue #110 — `~/.claude/stats-cache.json` 의존 제거 회귀 가드.
  // 우발적으로 usage 필드가 부활하면 즉시 fail.
  it('snapshot 에 usage 필드가 부재한다 (issue #110)', () => {
    const snap = buildClaudeSnapshot(FAKE_PATH, () => null, []);
    assert.equal('usage' in snap, false, 'usage 필드는 v0.3.0 에서 제거됨');
  });

  it('prefers agent-store account over claude-cli-import credentials', () => {
    const fakeCreds = {
      accessToken: 'cli',
      refreshToken: null,
      expiresAt: null,
      scopes: [],
      subscriptionType: null,
      rateLimitTier: null,
    };
    const agentAccount = {
      accountKey: 'claude:alice',
      provider: 'claude',
      source: 'agent-store',
      status: 'active',
      tokens: { accessToken: 'agent-store-tok' },
    };
    const snap = buildClaudeSnapshot(
      FAKE_PATH,
      () => fakeCreds,
      [agentAccount],
      '/tmp/stats.json',
      () => null,
    );
    assert.equal(snap.authSource, 'agent-store');
    assert.equal(snap.selectedAccount.accountKey, 'claude:alice');
  });
});

describe('resolveClaudeProfileFromSnapshot (via claude-provider)', () => {
  it('returns null when selectedAccount is missing', () => {
    assert.equal(resolveClaudeProfileFromSnapshot({ selectedAccount: null }), null);
  });

  it('extracts accessToken from claude-cli-import (top-level)', () => {
    const profile = resolveClaudeProfileFromSnapshot({
      selectedAccount: {
        accountKey: 'claude-cli-import',
        accessToken: 'sk-ant-cli',
        email: 'x@example.com',
        displayName: 'Claude Import',
        label: 'personal',
      },
    });
    assert.equal(profile.id, 'claude-cli-import');
    assert.equal(profile.accountKey, 'claude-cli-import');
    assert.equal(profile.accessToken, 'sk-ant-cli');
    assert.equal(profile.email, 'x@example.com');
    assert.equal(profile.displayName, 'Claude Import');
    assert.equal(profile.label, 'personal');
  });

  it('extracts accessToken from tokens.accessToken (agent-store)', () => {
    const profile = resolveClaudeProfileFromSnapshot({
      selectedAccount: {
        accountKey: 'claude:alice',
        tokens: { accessToken: 'sk-ant-store' },
      },
    });
    assert.equal(profile.accessToken, 'sk-ant-store');
  });

  it('returns null when no accessToken anywhere', () => {
    assert.equal(resolveClaudeProfileFromSnapshot({ selectedAccount: { accountKey: 'x' } }), null);
  });
});

describe('getClaudeSnapshot — disabled config contract', () => {
  it('returns networkUsages=[] when claude provider is disabled (issue #119: networkUsage alias 제거됨)', async () => {
    const snap = await getClaudeSnapshot({ providers: { claude: { enabled: false } } });
    assert.deepEqual(snap.networkUsages, []);
    // backward-compat alias 부재 회귀 가드
    assert.equal('networkUsage' in snap, false);
    assert.equal('importedAccount' in snap, false);
    assert.equal('parsed' in snap, false);
    assert.ok(typeof snap.authSource === 'string');
  });
});

describe('filterEntriesByAccount (claude-provider)', () => {
  it('filters agent-store entry arrays by mapped profile fields', () => {
    const entries = [
      {
        account: { accountKey: 'a' },
        profile: { id: 'anthropic-claude:a', email: 'a@x.com', label: 'work' },
      },
      {
        account: { accountKey: 'b' },
        profile: { id: 'anthropic-claude:b', email: 'b@x.com', label: 'personal' },
      },
    ];

    assert.equal(filterEntriesByAccount(entries, 'anthropic-claude:a').length, 1);
    assert.equal(filterEntriesByAccount(entries, 'B@X.COM').length, 1);
    assert.equal(filterEntriesByAccount(entries, 'personal').length, 1);
    assert.equal(filterEntriesByAccount(entries, 'nope').length, 0);
  });
});

describe('filterProfilesByAccount (claude-provider)', () => {
  const profiles = [
    { id: 'anthropic-claude:a', email: 'a@x.com' },
    { id: 'anthropic-claude:b', email: 'b@x.com' },
  ];

  it('returns all when filter falsy', () => {
    assert.deepEqual(filterProfilesByAccount(profiles, null), profiles);
  });

  it('filters by accountKey or email (case-insensitive)', () => {
    assert.equal(filterProfilesByAccount(profiles, 'anthropic-claude:a').length, 1);
    assert.equal(filterProfilesByAccount(profiles, 'A@X.COM').length, 1);
  });

  it('returns empty for no match', () => {
    assert.deepEqual(filterProfilesByAccount(profiles, 'nope'), []);
  });
});
