import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { refreshClaudeToken } from '../../src/claude/refresh-claude-token.js';
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

describe('refreshClaudeToken — input validation', () => {
  it('throws when refreshToken is missing', async () => {
    await assert.rejects(() => refreshClaudeToken({ refreshToken: '' }), /refreshToken.*비어/);
  });
});

describe('refreshClaudeToken', () => {
  it('POSTs form-encoded body to the configured token endpoint', async () => {
    let capturedUrl = null;
    let capturedInit = null;
    const fetchImpl = async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return jsonResponse({
        body: {
          access_token: 'new-at',
          refresh_token: 'new-rt',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      });
    };

    await refreshClaudeToken({
      refreshToken: 'old-rt',
      fetchImpl,
    });

    assert.equal(capturedUrl, CLAUDE_AUTH.tokenEndpoint);
    assert.equal(capturedInit.method, 'POST');
    assert.equal(capturedInit.headers['Content-Type'], 'application/json');

    const payload = JSON.parse(capturedInit.body);
    assert.equal(payload.grant_type, 'refresh_token');
    assert.equal(payload.refresh_token, 'old-rt');
    assert.equal(payload.client_id, CLAUDE_AUTH.observedClientId);
    assert.equal(payload.client_secret, undefined);
  });

  it('includes client_secret when provided', async () => {
    let captured;
    const fetchImpl = async (_url, init) => {
      captured = init;
      return jsonResponse({
        body: { access_token: 'x', expires_in: 1, token_type: 'Bearer' },
      });
    };

    await refreshClaudeToken({
      refreshToken: 'rt',
      clientSecret: 'secret!',
      fetchImpl,
    });

    assert.equal(JSON.parse(captured.body).client_secret, 'secret!');
  });

  it('returns normalized token fields on 200', async () => {
    const fetchImpl = async () =>
      jsonResponse({
        body: {
          access_token: 'at-new',
          refresh_token: 'rt-new',
          id_token: 'id-new',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'user:profile',
        },
      });

    const result = await refreshClaudeToken({
      refreshToken: 'rt-old',
      fetchImpl,
    });

    assert.equal(result.accessToken, 'at-new');
    assert.equal(result.refreshToken, 'rt-new');
    assert.equal(result.idToken, 'id-new');
    assert.equal(result.expiresIn, 3600);
    assert.equal(result.tokenType, 'Bearer');
    assert.equal(result.scope, 'user:profile');
  });

  it('keeps existing refreshToken when response omits refresh_token (no rotation)', async () => {
    const fetchImpl = async () =>
      jsonResponse({
        body: {
          access_token: 'at-new',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      });

    const result = await refreshClaudeToken({
      refreshToken: 'rt-kept',
      fetchImpl,
    });

    assert.equal(result.refreshToken, 'rt-kept');
    assert.equal(result.idToken, null);
    assert.equal(result.scope, null);
  });

  it('throws descriptive error on non-2xx response', async () => {
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
        refreshClaudeToken({
          refreshToken: 'rt',
          fetchImpl,
        }),
      /Claude token refresh failed: 400/,
    );
  });
});
