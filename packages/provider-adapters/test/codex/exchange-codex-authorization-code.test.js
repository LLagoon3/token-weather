import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  exchangeCodexAuthorizationCode,
  refreshCodexToken,
} from '../../src/codex/exchange-codex-authorization-code.js';
import { CODEX_AUTH } from '../../src/codex/codex-auth-constants.js';

function jsonResponse({ status = 200, body = {} } = {}) {
  const text = JSON.stringify(body);
  return {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    ok: status >= 200 && status < 300,
    async text() {
      return text;
    },
    async json() {
      return JSON.parse(text);
    },
  };
}

function baseExchangeParams(overrides = {}) {
  return {
    code: 'ac_code_abc',
    callbackUrl: 'http://localhost:1455/auth/callback',
    codeVerifier: 'verifier-xyz',
    ...overrides,
  };
}

describe('exchangeCodexAuthorizationCode — guard', () => {
  it('throws when allowLiveExchange is not true', async () => {
    await assert.rejects(
      () => exchangeCodexAuthorizationCode(baseExchangeParams()),
      /Live exchange is disabled/,
    );
  });
});

describe('exchangeCodexAuthorizationCode — live exchange', () => {
  it('POSTs form-urlencoded body to CODEX_AUTH.tokenEndpoint', async () => {
    let capturedUrl, capturedInit;
    const fetchImpl = async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return jsonResponse({
        body: {
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      });
    };

    await exchangeCodexAuthorizationCode({
      ...baseExchangeParams(),
      allowLiveExchange: true,
      fetchImpl,
    });

    assert.equal(capturedUrl, CODEX_AUTH.tokenEndpoint);
    assert.equal(capturedInit.method, 'POST');
    assert.equal(capturedInit.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const params = new URLSearchParams(capturedInit.body);
    assert.equal(params.get('grant_type'), 'authorization_code');
    assert.equal(params.get('code'), 'ac_code_abc');
    assert.equal(params.get('redirect_uri'), 'http://localhost:1455/auth/callback');
    assert.equal(params.get('code_verifier'), 'verifier-xyz');
    assert.equal(params.get('client_id'), CODEX_AUTH.observedClientId);
    assert.equal(params.has('client_secret'), false);
  });

  it('includes client_secret when provided', async () => {
    let captured;
    const fetchImpl = async (_u, init) => {
      captured = init;
      return jsonResponse({ body: { access_token: 'a', expires_in: 1, token_type: 'Bearer' } });
    };
    await exchangeCodexAuthorizationCode({
      ...baseExchangeParams(),
      allowLiveExchange: true,
      clientSecret: 's3cret',
      fetchImpl,
    });
    assert.equal(new URLSearchParams(captured.body).get('client_secret'), 's3cret');
  });

  it('returns normalized token fields', async () => {
    const fetchImpl = async () =>
      jsonResponse({
        body: {
          access_token: 'at',
          refresh_token: 'rt',
          id_token: 'id',
          expires_in: 7200,
          token_type: 'Bearer',
          scope: 'openid email',
        },
      });
    const result = await exchangeCodexAuthorizationCode({
      ...baseExchangeParams(),
      allowLiveExchange: true,
      fetchImpl,
    });
    assert.equal(result.accessToken, 'at');
    assert.equal(result.refreshToken, 'rt');
    assert.equal(result.idToken, 'id');
    assert.equal(result.expiresIn, 7200);
    assert.equal(result.tokenType, 'Bearer');
    assert.equal(result.scope, 'openid email');
  });

  it('throws descriptive error on non-2xx', async () => {
    const fetchImpl = async () => ({
      status: 400,
      statusText: 'Bad Request',
      ok: false,
      async text() {
        return '{"error":"invalid_grant"}';
      },
    });
    await assert.rejects(
      () =>
        exchangeCodexAuthorizationCode({
          ...baseExchangeParams(),
          allowLiveExchange: true,
          fetchImpl,
        }),
      /Token exchange failed: 400/,
    );
  });
});

describe('refreshCodexToken — guard', () => {
  it('throws when allowLiveExchange is not true', async () => {
    await assert.rejects(
      () => refreshCodexToken({ refreshToken: 'rt' }),
      /Live exchange is disabled/,
    );
  });
});

describe('refreshCodexToken — live refresh', () => {
  it('POSTs refresh_token grant with client_id', async () => {
    let captured;
    const fetchImpl = async (_u, init) => {
      captured = init;
      return jsonResponse({
        body: {
          access_token: 'at',
          refresh_token: 'rt-new',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      });
    };
    await refreshCodexToken({
      refreshToken: 'rt-old',
      allowLiveExchange: true,
      fetchImpl,
    });
    const params = new URLSearchParams(captured.body);
    assert.equal(params.get('grant_type'), 'refresh_token');
    assert.equal(params.get('refresh_token'), 'rt-old');
    assert.equal(params.get('client_id'), CODEX_AUTH.observedClientId);
  });

  it('keeps existing refreshToken when response omits one (no rotation)', async () => {
    const fetchImpl = async () =>
      jsonResponse({ body: { access_token: 'a', expires_in: 1, token_type: 'Bearer' } });
    const result = await refreshCodexToken({
      refreshToken: 'rt-kept',
      allowLiveExchange: true,
      fetchImpl,
    });
    assert.equal(result.refreshToken, 'rt-kept');
  });

  it('uses rotated refreshToken when server returns one', async () => {
    const fetchImpl = async () =>
      jsonResponse({
        body: {
          access_token: 'a',
          refresh_token: 'rt-rotated',
          expires_in: 1,
          token_type: 'Bearer',
        },
      });
    const result = await refreshCodexToken({
      refreshToken: 'rt-old',
      allowLiveExchange: true,
      fetchImpl,
    });
    assert.equal(result.refreshToken, 'rt-rotated');
  });

  it('throws descriptive error on non-2xx', async () => {
    const fetchImpl = async () => ({
      status: 401,
      statusText: 'Unauthorized',
      ok: false,
      async text() {
        return 'expired';
      },
    });
    await assert.rejects(
      () =>
        refreshCodexToken({
          refreshToken: 'rt',
          allowLiveExchange: true,
          fetchImpl,
        }),
      /Token refresh failed: 401/,
    );
  });
});
