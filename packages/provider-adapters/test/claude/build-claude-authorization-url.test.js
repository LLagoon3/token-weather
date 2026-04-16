import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildClaudeAuthorizationUrl } from '../../src/claude/build-claude-authorization-url.js';
import { CLAUDE_AUTH } from '../../src/claude/claude-auth-constants.js';

function baseParams(overrides = {}) {
  return {
    callbackUrl: 'http://localhost:1455/callback',
    state: 'state-abc',
    codeChallenge: 'challenge-xyz',
    codeChallengeMethod: 'S256',
    ...overrides,
  };
}

describe('buildClaudeAuthorizationUrl', () => {
  it('targets CLAUDE_AUTH.authorizationEndpoint', () => {
    const result = buildClaudeAuthorizationUrl(baseParams());
    const url = new URL(result);
    assert.equal(`${url.origin}${url.pathname}`, CLAUDE_AUTH.authorizationEndpoint);
  });

  it('sets required OAuth query parameters', () => {
    const url = new URL(buildClaudeAuthorizationUrl(baseParams()));
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('client_id'), CLAUDE_AUTH.observedClientId);
    assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:1455/callback');
    assert.equal(url.searchParams.get('state'), 'state-abc');
    assert.equal(url.searchParams.get('code_challenge'), 'challenge-xyz');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  });

  it('includes observed extra param code=true (claude authorize 요구사항)', () => {
    const url = new URL(buildClaudeAuthorizationUrl(baseParams()));
    assert.equal(url.searchParams.get('code'), 'true');
  });

  it('defaults scope to CLAUDE_AUTH.defaultScopes joined by space', () => {
    const url = new URL(buildClaudeAuthorizationUrl(baseParams()));
    assert.equal(url.searchParams.get('scope'), CLAUDE_AUTH.defaultScopes.join(' '));
  });

  it('allows overriding clientId and scopes', () => {
    const url = new URL(
      buildClaudeAuthorizationUrl(
        baseParams({ clientId: 'custom-client', scopes: ['user:profile'] }),
      ),
    );
    assert.equal(url.searchParams.get('client_id'), 'custom-client');
    assert.equal(url.searchParams.get('scope'), 'user:profile');
  });
});
