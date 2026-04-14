import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveImportedClaudeAccounts } from '../../src/claude/resolve-imported-claude-accounts.js';

const VALID_OAUTH = {
  accessToken: 'tok',
  refreshToken: 'ref',
  expiresAt: 1999999999,
  scopes: ['user:read'],
  subscriptionType: 'pro',
  rateLimitTier: 'tier-1',
};

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
    const result = resolveImportedClaudeAccounts(VALID_OAUTH);
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

  it('returned account has correct token fields', () => {
    const [account] = resolveImportedClaudeAccounts(VALID_OAUTH);
    assert.equal(account.accessToken, 'tok');
    assert.equal(account.refreshToken, 'ref');
    assert.equal(account.expiresAt, 1999999999);
    assert.deepEqual(account.scopes, ['user:read']);
    assert.equal(account.subscriptionType, 'pro');
    assert.equal(account.rateLimitTier, 'tier-1');
  });
});
