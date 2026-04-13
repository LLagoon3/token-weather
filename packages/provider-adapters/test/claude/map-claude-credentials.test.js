import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mapClaudeCredentials } from '../../src/claude/map-claude-credentials.js';

const FULL_OAUTH = {
  accessToken: 'access-tok',
  refreshToken: 'refresh-tok',
  expiresAt: 1999999999,
  scopes: ['user:read', 'usage:read'],
  subscriptionType: 'pro',
  rateLimitTier: 'tier-1',
};

describe('mapClaudeCredentials', () => {
  it('maps all fields from a complete oauth object', () => {
    const result = mapClaudeCredentials(FULL_OAUTH);
    assert.equal(result.provider, 'claude');
    assert.equal(result.accessToken, 'access-tok');
    assert.equal(result.refreshToken, 'refresh-tok');
    assert.equal(result.expiresAt, 1999999999);
    assert.deepEqual(result.scopes, ['user:read', 'usage:read']);
    assert.equal(result.subscriptionType, 'pro');
    assert.equal(result.rateLimitTier, 'tier-1');
  });

  it('returns null for null input', () => {
    assert.equal(mapClaudeCredentials(null), null);
  });

  it('returns null for non-object input', () => {
    assert.equal(mapClaudeCredentials('string'), null);
    assert.equal(mapClaudeCredentials(42), null);
    assert.equal(mapClaudeCredentials(undefined), null);
  });

  it('sets missing optional fields to null', () => {
    const result = mapClaudeCredentials({});
    assert.equal(result.accessToken, null);
    assert.equal(result.refreshToken, null);
    assert.equal(result.expiresAt, null);
    assert.equal(result.subscriptionType, null);
    assert.equal(result.rateLimitTier, null);
  });

  it('sets scopes to empty array when missing', () => {
    const result = mapClaudeCredentials({});
    assert.deepEqual(result.scopes, []);
  });

  it('sets scopes to empty array when scopes is not an array', () => {
    assert.deepEqual(mapClaudeCredentials({ scopes: 'openid' }).scopes, []);
    assert.deepEqual(mapClaudeCredentials({ scopes: null }).scopes, []);
    assert.deepEqual(mapClaudeCredentials({ scopes: 123 }).scopes, []);
  });

  it('always sets provider to "claude"', () => {
    assert.equal(mapClaudeCredentials({}).provider, 'claude');
    assert.equal(mapClaudeCredentials(FULL_OAUTH).provider, 'claude');
  });
});
