import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildImportedClaudeAccount } from '../../src/claude/build-imported-account.js';

const FULL_OAUTH = {
  accessToken: 'access-tok',
  refreshToken: 'refresh-tok',
  expiresAt: 1999999999,
  scopes: ['user:read', 'usage:read'],
  subscriptionType: 'pro',
  rateLimitTier: 'tier-1',
};

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
