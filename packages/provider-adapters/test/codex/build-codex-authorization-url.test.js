import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildCodexAuthorizationUrl } from '../../src/codex/build-codex-authorization-url.js';
import { CODEX_AUTH } from '../../src/codex/codex-auth-constants.js';

const BASE_PARAMS = {
  callbackUrl: 'http://localhost:1455/auth/callback',
  state: 'test-state-xyz',
  codeChallenge: 'test-challenge-abc',
  codeChallengeMethod: 'S256',
};

describe('buildCodexAuthorizationUrl', () => {
  it('uses https://auth.openai.com/oauth/authorize as the authorization endpoint', () => {
    const result = buildCodexAuthorizationUrl(BASE_PARAMS);
    const url = new URL(result);
    assert.equal(`${url.origin}${url.pathname}`, 'https://auth.openai.com/oauth/authorize');
  });

  it('includes required OAuth query parameters', () => {
    const result = buildCodexAuthorizationUrl(BASE_PARAMS);
    const params = new URL(result).searchParams;

    assert.ok(params.has('response_type'), 'missing response_type');
    assert.ok(params.has('client_id'), 'missing client_id');
    assert.ok(params.has('redirect_uri'), 'missing redirect_uri');
    assert.ok(params.has('state'), 'missing state');
    assert.ok(params.has('scope'), 'missing scope');
    assert.ok(params.has('code_challenge'), 'missing code_challenge');
    assert.ok(params.has('code_challenge_method'), 'missing code_challenge_method');
  });

  it('sets correct values for the standard OAuth params', () => {
    const result = buildCodexAuthorizationUrl(BASE_PARAMS);
    const params = new URL(result).searchParams;

    assert.equal(params.get('response_type'), 'code');
    assert.equal(params.get('client_id'), CODEX_AUTH.observedClientId);
    assert.equal(params.get('redirect_uri'), BASE_PARAMS.callbackUrl);
    assert.equal(params.get('state'), BASE_PARAMS.state);
    assert.equal(params.get('code_challenge'), BASE_PARAMS.codeChallenge);
    assert.equal(params.get('code_challenge_method'), BASE_PARAMS.codeChallengeMethod);
  });

  it('includes observed extra params: id_token_add_organizations, codex_cli_simplified_flow, originator', () => {
    const result = buildCodexAuthorizationUrl(BASE_PARAMS);
    const params = new URL(result).searchParams;

    assert.equal(params.get('id_token_add_organizations'), 'true');
    assert.equal(params.get('codex_cli_simplified_flow'), 'true');
    assert.equal(params.get('originator'), 'pi');
  });

  it('reflects custom clientId and scopes override', () => {
    const result = buildCodexAuthorizationUrl({
      ...BASE_PARAMS,
      clientId: 'custom-client-id',
      scopes: ['openid', 'custom_scope'],
    });
    const params = new URL(result).searchParams;

    assert.equal(params.get('client_id'), 'custom-client-id');
    assert.equal(params.get('scope'), 'openid custom_scope');
  });
});
