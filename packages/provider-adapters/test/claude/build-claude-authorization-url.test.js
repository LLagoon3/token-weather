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

  it('matches the current pi-ai Anthropic authorize endpoint baseline', () => {
    // pi-ai (@mariozechner/pi-ai)와 일치해야 invalid_grant 회귀(이슈 #83)
    // 의심 변수가 줄어든다. 새 외부 baseline으로 회귀하면 본 테스트가 실패해
    // 명시적 의사결정을 강제한다.
    assert.equal(CLAUDE_AUTH.authorizationEndpoint, 'https://claude.ai/oauth/authorize');
  });

  it('matches the current pi-ai Anthropic scope baseline (6 scopes)', () => {
    // pi-ai와 동일한 6개 scope. user:sessions:claude_code / user:mcp_servers /
    // user:file_upload가 빠지면 invalid_grant 또는 권한 부족 응답이 관찰됐었다
    // (이슈 #83). 누군가 다시 3-scope 기준으로 회귀시키면 본 테스트가 명시적
    // 의사결정을 강제한다.
    assert.deepEqual(CLAUDE_AUTH.defaultScopes, [
      'org:create_api_key',
      'user:profile',
      'user:inference',
      'user:sessions:claude_code',
      'user:mcp_servers',
      'user:file_upload',
    ]);
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
