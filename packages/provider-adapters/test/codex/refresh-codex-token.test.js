import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { refreshCodexToken } from '../../src/codex/refresh-codex-token.js';
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

describe('refreshCodexToken', () => {
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
          fetchImpl,
        }),
      /Token refresh failed: 401/,
    );
  });
});
