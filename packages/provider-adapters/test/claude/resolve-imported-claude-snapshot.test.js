import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveImportedClaudeSnapshot } from '../../src/claude/resolve-imported-claude-snapshot.js';

const VALID_OAUTH = {
  accessToken: 'tok',
  refreshToken: 'ref',
  expiresAt: 1999999999,
  scopes: ['user:read'],
  subscriptionType: 'pro',
  rateLimitTier: 'tier-1',
};

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
    const result = resolveImportedClaudeSnapshot(VALID_OAUTH);
    assert.equal(result.authSource, 'claude-cli-import');
    assert.equal(result.accounts.length, 1);
  });

  it('returned account has correct shape', () => {
    const { accounts } = resolveImportedClaudeSnapshot(VALID_OAUTH);
    const [account] = accounts;
    assert.equal(account.provider, 'claude');
    assert.equal(account.source, 'claude-cli-import');
    assert.equal(account.accountKey, 'claude-cli-import');
    assert.equal(account.authType, 'oauth');
    assert.equal(account.accessToken, 'tok');
    assert.equal(account.refreshToken, 'ref');
  });

  it('returns claude-cli-import for empty oauth object', () => {
    const result = resolveImportedClaudeSnapshot({});
    assert.equal(result.authSource, 'claude-cli-import');
    assert.equal(result.accounts.length, 1);
    assert.equal(result.accounts[0].accessToken, null);
  });
});
