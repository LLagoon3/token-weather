import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { exchangeClaudeAuthorizationCode } from '../../src/claude/exchange-claude-authorization-code.js';
import { CLAUDE_AUTH } from '../../src/claude/claude-auth-constants.js';

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

function baseParams(overrides = {}) {
  return {
    code: 'code-123',
    callbackUrl: 'http://localhost:1455/callback',
    codeVerifier: 'verifier-abc',
    state: 'state-xyz',
    ...overrides,
  };
}

describe('exchangeClaudeAuthorizationCode — argument guards', () => {
  it('throws when code is empty', async () => {
    await assert.rejects(
      () => exchangeClaudeAuthorizationCode(baseParams({ code: '', allowLiveExchange: true })),
      /code가 비어/,
    );
  });

  it('throws when callbackUrl is empty', async () => {
    await assert.rejects(
      () =>
        exchangeClaudeAuthorizationCode(baseParams({ callbackUrl: '', allowLiveExchange: true })),
      /callbackUrl이 비어/,
    );
  });

  it('throws when codeVerifier is empty', async () => {
    await assert.rejects(
      () =>
        exchangeClaudeAuthorizationCode(baseParams({ codeVerifier: '', allowLiveExchange: true })),
      /codeVerifier가 비어/,
    );
  });

  it('throws when allowLiveExchange is not set', async () => {
    await assert.rejects(
      () => exchangeClaudeAuthorizationCode(baseParams()),
      /Live exchange is disabled/,
    );
  });
});

describe('exchangeClaudeAuthorizationCode — live exchange', () => {
  it('POSTs authorization_code grant with required fields', async () => {
    let captured;
    const fetchImpl = async (url, init) => {
      captured = { url, init };
      return jsonResponse({
        body: {
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      });
    };

    await exchangeClaudeAuthorizationCode({
      ...baseParams(),
      allowLiveExchange: true,
      fetchImpl,
    });

    assert.equal(captured.url, CLAUDE_AUTH.tokenEndpoint);
    assert.equal(captured.init.headers['Content-Type'], 'application/json');
    const payload = JSON.parse(captured.init.body);
    assert.equal(payload.grant_type, 'authorization_code');
    assert.equal(payload.code, 'code-123');
    assert.equal(payload.redirect_uri, 'http://localhost:1455/callback');
    assert.equal(payload.code_verifier, 'verifier-abc');
    assert.equal(payload.client_id, CLAUDE_AUTH.observedClientId);
    assert.equal(payload.state, 'state-xyz');
  });

  it('returns normalized token fields on 200', async () => {
    const fetchImpl = async () =>
      jsonResponse({
        body: {
          access_token: 'at',
          refresh_token: 'rt',
          id_token: 'id',
          expires_in: 7200,
          token_type: 'Bearer',
          scope: 'user:profile',
        },
      });

    const result = await exchangeClaudeAuthorizationCode({
      ...baseParams(),
      allowLiveExchange: true,
      fetchImpl,
    });

    assert.equal(result.accessToken, 'at');
    assert.equal(result.refreshToken, 'rt');
    assert.equal(result.idToken, 'id');
    assert.equal(result.expiresIn, 7200);
    assert.equal(result.tokenType, 'Bearer');
    assert.equal(result.scope, 'user:profile');
  });

  it('throws descriptive error on non-2xx response', async () => {
    const fetchImpl = async () => ({
      status: 400,
      statusText: 'Bad Request',
      ok: false,
      async text() {
        return 'invalid_grant';
      },
    });
    await assert.rejects(
      () =>
        exchangeClaudeAuthorizationCode({
          ...baseParams(),
          allowLiveExchange: true,
          fetchImpl,
        }),
      /Claude token exchange failed: 400/,
    );
  });
});
