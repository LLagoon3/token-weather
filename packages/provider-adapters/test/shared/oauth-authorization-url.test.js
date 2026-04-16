import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildOAuthAuthorizationUrl } from '../../src/shared/oauth-authorization-url.js';

describe('buildOAuthAuthorizationUrl', () => {
  it('preserves the endpoint origin + pathname', () => {
    const url = new URL(
      buildOAuthAuthorizationUrl({
        endpoint: 'https://auth.example.com/oauth/authorize',
        params: { client_id: 'abc' },
      }),
    );
    assert.equal(url.origin, 'https://auth.example.com');
    assert.equal(url.pathname, '/oauth/authorize');
  });

  it('sets all params in insertion order', () => {
    const out = buildOAuthAuthorizationUrl({
      endpoint: 'https://x.test/a',
      params: { a: '1', b: '2', c: '3' },
    });
    // searchParams preserves insertion order
    assert.ok(out.includes('a=1&b=2&c=3'));
  });

  it('stringifies non-string values', () => {
    const url = new URL(
      buildOAuthAuthorizationUrl({
        endpoint: 'https://x.test/a',
        params: { n: 42, b: true },
      }),
    );
    assert.equal(url.searchParams.get('n'), '42');
    assert.equal(url.searchParams.get('b'), 'true');
  });

  it('skips null/undefined values', () => {
    const url = new URL(
      buildOAuthAuthorizationUrl({
        endpoint: 'https://x.test/a',
        params: { keep: 'y', skip1: null, skip2: undefined },
      }),
    );
    assert.equal(url.searchParams.get('keep'), 'y');
    assert.equal(url.searchParams.has('skip1'), false);
    assert.equal(url.searchParams.has('skip2'), false);
  });

  it('handles empty params', () => {
    const out = buildOAuthAuthorizationUrl({
      endpoint: 'https://x.test/a',
      params: {},
    });
    assert.equal(out, 'https://x.test/a');
  });

  it('throws when endpoint is missing', () => {
    assert.throws(() => buildOAuthAuthorizationUrl({ params: {} }), /endpoint required/);
  });
});
