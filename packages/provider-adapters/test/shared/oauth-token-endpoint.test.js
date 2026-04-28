import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { postToTokenEndpoint } from '../../src/shared/oauth-token-endpoint.js';

function okResponse(body = {}) {
  const text = JSON.stringify(body);
  return {
    status: 200,
    statusText: 'OK',
    ok: true,
    async text() {
      return text;
    },
    async json() {
      return JSON.parse(text);
    },
  };
}

function errorResponse(status, body = 'err') {
  return {
    status,
    statusText: 'Error',
    ok: false,
    async text() {
      return body;
    },
  };
}

describe('postToTokenEndpoint — form encoding (default)', () => {
  it('sends x-www-form-urlencoded body and normalizes response', async () => {
    let captured;
    const fetchImpl = async (url, init) => {
      captured = { url, init };
      return okResponse({
        access_token: 'at',
        refresh_token: 'rt',
        id_token: 'id',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'profile',
      });
    };

    const result = await postToTokenEndpoint({
      endpoint: 'https://token.test/v1/token',
      body: { grant_type: 'authorization_code', code: 'c' },
      fetchImpl,
    });

    assert.equal(captured.url, 'https://token.test/v1/token');
    assert.equal(captured.init.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const params = new URLSearchParams(captured.init.body);
    assert.equal(params.get('grant_type'), 'authorization_code');
    assert.equal(params.get('code'), 'c');

    assert.deepEqual(result, {
      accessToken: 'at',
      refreshToken: 'rt',
      idToken: 'id',
      expiresIn: 3600,
      tokenType: 'Bearer',
      scope: 'profile',
    });
  });

  it('skips null/undefined body fields', async () => {
    let captured;
    const fetchImpl = async (_u, init) => {
      captured = init;
      return okResponse({ access_token: 'a', expires_in: 1, token_type: 'Bearer' });
    };
    await postToTokenEndpoint({
      endpoint: 'https://t.test/tok',
      body: { a: '1', skip1: null, skip2: undefined, b: '2' },
      fetchImpl,
    });
    const params = new URLSearchParams(captured.body);
    assert.equal(params.get('a'), '1');
    assert.equal(params.has('skip1'), false);
    assert.equal(params.has('skip2'), false);
    assert.equal(params.get('b'), '2');
  });
});

describe('postToTokenEndpoint — json encoding', () => {
  it('sends application/json body', async () => {
    let captured;
    const fetchImpl = async (_u, init) => {
      captured = init;
      return okResponse({
        access_token: 'at',
        expires_in: 60,
        token_type: 'Bearer',
      });
    };

    await postToTokenEndpoint({
      endpoint: 'https://t.test/tok',
      body: { grant_type: 'authorization_code', code: 'c', state: 's' },
      encoding: 'json',
      fetchImpl,
    });

    assert.equal(captured.headers['Content-Type'], 'application/json');
    assert.equal(captured.headers.Accept, 'application/json');
    const parsed = JSON.parse(captured.body);
    assert.equal(parsed.code, 'c');
    assert.equal(parsed.state, 's');
  });
});

describe('postToTokenEndpoint — extra headers', () => {
  it('merges extraHeaders into request', async () => {
    let captured;
    const fetchImpl = async (_u, init) => {
      captured = init;
      return okResponse({ access_token: 'a', expires_in: 1, token_type: 'Bearer' });
    };
    await postToTokenEndpoint({
      endpoint: 'https://t.test/tok',
      body: { a: '1' },
      extraHeaders: { 'x-custom': 'v' },
      fetchImpl,
    });
    assert.equal(captured.headers['x-custom'], 'v');
  });
});

describe('postToTokenEndpoint — error handling', () => {
  it('throws descriptive error on non-2xx', async () => {
    const fetchImpl = async () => errorResponse(400, '{"error":"invalid_grant"}');
    await assert.rejects(
      () =>
        postToTokenEndpoint({
          endpoint: 'https://t.test/tok',
          body: { a: '1' },
          fetchImpl,
          errorPrefix: 'Custom prefix',
        }),
      /Custom prefix: 400 Error — {"error":"invalid_grant"}/,
    );
  });

  it('throws when encoding is unknown', async () => {
    await assert.rejects(
      () =>
        postToTokenEndpoint({
          endpoint: 'https://t.test/tok',
          body: {},
          encoding: 'xml',
          fetchImpl: async () => okResponse({}),
        }),
      /unknown encoding "xml"/,
    );
  });
});

describe('postToTokenEndpoint — fallbackRefreshToken', () => {
  it('returns response refresh_token when present', async () => {
    const fetchImpl = async () =>
      okResponse({
        access_token: 'at',
        refresh_token: 'new-rt',
        expires_in: 1,
        token_type: 'Bearer',
      });
    const result = await postToTokenEndpoint({
      endpoint: 'https://t.test/tok',
      body: { grant_type: 'refresh_token' },
      fetchImpl,
      fallbackRefreshToken: 'old-rt',
    });
    assert.equal(result.refreshToken, 'new-rt');
  });

  it('returns fallback when response omits refresh_token', async () => {
    const fetchImpl = async () =>
      okResponse({ access_token: 'at', expires_in: 1, token_type: 'Bearer' });
    const result = await postToTokenEndpoint({
      endpoint: 'https://t.test/tok',
      body: { grant_type: 'refresh_token' },
      fetchImpl,
      fallbackRefreshToken: 'old-rt',
    });
    assert.equal(result.refreshToken, 'old-rt');
  });
});

