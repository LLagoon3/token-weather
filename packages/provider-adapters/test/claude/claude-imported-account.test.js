import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildImportedClaudeAccount,
  resolveImportedClaudeAccounts,
  selectClaudeAccountsSource,
  resolveImportedClaudeSnapshot,
} from '../../src/claude/claude-imported-account.js';

const FULL_OAUTH = {
  accessToken: 'access-tok',
  refreshToken: 'refresh-tok',
  expiresAt: 1999999999,
  scopes: ['user:read', 'usage:read'],
  subscriptionType: 'pro',
  rateLimitTier: 'tier-1',
};

const AGENT_ACCOUNT = { provider: 'claude', source: 'agent-store' };
const IMPORTED_ACCOUNT = { provider: 'claude', source: 'claude-cli-import' };

describe('buildImportedClaudeAccount', () => {
  it('returns null for null input', () => {
    assert.equal(buildImportedClaudeAccount(null), null);
  });

  it('returns null for non-object input', () => {
    assert.equal(buildImportedClaudeAccount('x'), null);
    assert.equal(buildImportedClaudeAccount(undefined), null);
  });

  it('sets fixed identity fields', () => {
    const result = buildImportedClaudeAccount(FULL_OAUTH);
    assert.equal(result.provider, 'claude');
    assert.equal(result.source, 'claude-cli-import');
    assert.equal(result.accountKey, 'claude-cli-import');
    assert.equal(result.authType, 'oauth');
  });

  it('maps all token fields from full oauth object', () => {
    const result = buildImportedClaudeAccount(FULL_OAUTH);
    assert.equal(result.accessToken, 'access-tok');
    assert.equal(result.refreshToken, 'refresh-tok');
    assert.equal(result.expiresAt, 1999999999);
    assert.deepEqual(result.scopes, ['user:read', 'usage:read']);
    assert.equal(result.subscriptionType, 'pro');
    assert.equal(result.rateLimitTier, 'tier-1');
  });

  it('sets missing optional fields to null with empty oauth', () => {
    const result = buildImportedClaudeAccount({});
    assert.equal(result.accessToken, null);
    assert.equal(result.refreshToken, null);
    assert.equal(result.expiresAt, null);
    assert.deepEqual(result.scopes, []);
    assert.equal(result.subscriptionType, null);
    assert.equal(result.rateLimitTier, null);
  });
});

describe('resolveImportedClaudeAccounts', () => {
  it('returns empty array for null input', () => {
    assert.deepEqual(resolveImportedClaudeAccounts(null), []);
  });

  it('returns empty array for undefined input', () => {
    assert.deepEqual(resolveImportedClaudeAccounts(undefined), []);
  });

  it('returns empty array for non-object input', () => {
    assert.deepEqual(resolveImportedClaudeAccounts('x'), []);
    assert.deepEqual(resolveImportedClaudeAccounts(42), []);
  });

  it('returns array with one account for valid oauth', () => {
    const result = resolveImportedClaudeAccounts(FULL_OAUTH);
    assert.equal(result.length, 1);
    assert.equal(result[0].provider, 'claude');
    assert.equal(result[0].source, 'claude-cli-import');
    assert.equal(result[0].accountKey, 'claude-cli-import');
  });

  it('returns array with one account for empty object (maps to nulls)', () => {
    const result = resolveImportedClaudeAccounts({});
    assert.equal(result.length, 1);
    assert.equal(result[0].provider, 'claude');
    assert.equal(result[0].accessToken, null);
  });

  it('returned account carries expected token fields', () => {
    const [account] = resolveImportedClaudeAccounts(FULL_OAUTH);
    assert.equal(account.accessToken, 'access-tok');
    assert.equal(account.refreshToken, 'refresh-tok');
    assert.equal(account.expiresAt, 1999999999);
    assert.deepEqual(account.scopes, ['user:read', 'usage:read']);
    assert.equal(account.subscriptionType, 'pro');
    assert.equal(account.rateLimitTier, 'tier-1');
  });
});

describe('selectClaudeAccountsSource', () => {
  it('returns agent-store when agentAccounts is non-empty', () => {
    const result = selectClaudeAccountsSource([AGENT_ACCOUNT], [IMPORTED_ACCOUNT]);
    assert.equal(result.authSource, 'agent-store');
    assert.deepEqual(result.accounts, [AGENT_ACCOUNT]);
  });

  it('returns claude-cli-import when agentAccounts is empty and importedAccounts is non-empty', () => {
    const result = selectClaudeAccountsSource([], [IMPORTED_ACCOUNT]);
    assert.equal(result.authSource, 'claude-cli-import');
    assert.deepEqual(result.accounts, [IMPORTED_ACCOUNT]);
  });

  it('returns not-found when both are empty', () => {
    const result = selectClaudeAccountsSource([], []);
    assert.equal(result.authSource, 'not-found');
    assert.deepEqual(result.accounts, []);
  });

  it('prefers agentAccounts even when importedAccounts is also non-empty', () => {
    const result = selectClaudeAccountsSource([AGENT_ACCOUNT], [IMPORTED_ACCOUNT]);
    assert.equal(result.authSource, 'agent-store');
  });

  it('returns all agentAccounts when multiple exist', () => {
    const accounts = [AGENT_ACCOUNT, { ...AGENT_ACCOUNT, accountKey: 'b' }];
    const result = selectClaudeAccountsSource(accounts, []);
    assert.deepEqual(result.accounts, accounts);
  });
});

describe('resolveImportedClaudeSnapshot', () => {
  it('returns not-found with empty accounts for null input', () => {
    const result = resolveImportedClaudeSnapshot(null);
    assert.deepEqual(result, { accounts: [], authSource: 'not-found' });
  });

  it('returns not-found with empty accounts for undefined input', () => {
    const result = resolveImportedClaudeSnapshot(undefined);
    assert.deepEqual(result, { accounts: [], authSource: 'not-found' });
  });

  it('returns claude-cli-import authSource for valid oauth', () => {
    const result = resolveImportedClaudeSnapshot(FULL_OAUTH);
    assert.equal(result.authSource, 'claude-cli-import');
    assert.equal(result.accounts.length, 1);
  });

  it('returned account has correct shape', () => {
    const { accounts } = resolveImportedClaudeSnapshot(FULL_OAUTH);
    const [account] = accounts;
    assert.equal(account.provider, 'claude');
    assert.equal(account.source, 'claude-cli-import');
    assert.equal(account.accountKey, 'claude-cli-import');
    assert.equal(account.authType, 'oauth');
    assert.equal(account.accessToken, 'access-tok');
    assert.equal(account.refreshToken, 'refresh-tok');
  });

  it('returns claude-cli-import for empty oauth object', () => {
    const result = resolveImportedClaudeSnapshot({});
    assert.equal(result.authSource, 'claude-cli-import');
    assert.equal(result.accounts.length, 1);
    assert.equal(result.accounts[0].accessToken, null);
  });
});
