import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  decodeJwtPayload,
  extractAccountIdentity,
} from '../../src/auth/token-claims.js';

// Helper: build a minimal unsigned JWT with a JSON payload.
function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

// ---------------------------------------------------------------------------
// decodeJwtPayload
// ---------------------------------------------------------------------------

describe('decodeJwtPayload', () => {
  it('decodes a valid 3-part JWT payload', () => {
    const payload = { sub: 'u123', email: 'user@example.com' };
    const result = decodeJwtPayload(makeJwt(payload));
    assert.equal(result.sub, 'u123');
    assert.equal(result.email, 'user@example.com');
  });

  it('returns null for null input', () => {
    assert.equal(decodeJwtPayload(null), null);
  });

  it('returns null for non-string input', () => {
    assert.equal(decodeJwtPayload(42), null);
    assert.equal(decodeJwtPayload({}), null);
    assert.equal(decodeJwtPayload(undefined), null);
  });

  it('returns null when parts count != 3', () => {
    assert.equal(decodeJwtPayload('only.two'), null);
    assert.equal(decodeJwtPayload('a.b.c.d'), null);
    assert.equal(decodeJwtPayload(''), null);
  });

  it('returns null for malformed base64 payload', () => {
    // middle part is not valid JSON after decoding
    assert.equal(decodeJwtPayload('header.!!!notbase64!!!.sig'), null);
  });
});

// ---------------------------------------------------------------------------
// extractAccountIdentity
// ---------------------------------------------------------------------------

describe('extractAccountIdentity — id_token email priority', () => {
  it('uses email from id_token when present', () => {
    const idToken = makeJwt({ sub: 's1', email: 'id@example.com', name: 'ID User' });
    const result = extractAccountIdentity({ idToken, accessToken: null, fallbackCode: 'code123' });
    assert.equal(result.email, 'id@example.com');
    assert.equal(result.accountId, 's1');
    assert.equal(result.displayName, 'ID User');
    assert.equal(result.claimSource, 'id_token:email');
  });

  it('falls back to preferred_username from id_token when email absent', () => {
    const idToken = makeJwt({ sub: 's2', preferred_username: 'pref_user' });
    const result = extractAccountIdentity({ idToken, accessToken: null, fallbackCode: 'code123' });
    assert.equal(result.email, 'pref_user');
    assert.equal(result.claimSource, 'id_token:preferred_username');
    assert.equal(result.displayName, 'pref_user');
  });

  it('falls back to sub-based email from id_token when no email/preferred_username', () => {
    const idToken = makeJwt({ sub: 'subonly' });
    const result = extractAccountIdentity({ idToken, accessToken: null, fallbackCode: 'code123' });
    assert.equal(result.email, 'subonly@codex.openai.com');
    assert.equal(result.claimSource, 'id_token:sub');
  });
});

describe('extractAccountIdentity — access_token fallback', () => {
  it('uses access_token claims when id_token has no usable identifier', () => {
    const idToken = makeJwt({ iat: 123 }); // no sub, email, preferred_username
    const accessToken = makeJwt({ sub: 'atsub', email: 'at@example.com' });
    const result = extractAccountIdentity({ idToken, accessToken, fallbackCode: 'code123' });
    assert.equal(result.email, 'at@example.com');
    assert.equal(result.claimSource, 'access_token:email');
  });

  it('uses access_token when id_token is null', () => {
    const accessToken = makeJwt({ sub: 'atsub2', preferred_username: 'atuser' });
    const result = extractAccountIdentity({ idToken: null, accessToken, fallbackCode: 'code123' });
    assert.equal(result.email, 'atuser');
    assert.equal(result.claimSource, 'access_token:preferred_username');
  });
});

describe('extractAccountIdentity — code-prefix fallback', () => {
  it('uses code-prefix fallback when both tokens are null', () => {
    const result = extractAccountIdentity({ idToken: null, accessToken: null, fallbackCode: 'abc123XY' });
    assert.equal(result.email, 'live-abc123XY@codex.openai.com');
    assert.equal(result.accountId, null);
    assert.equal(result.displayName, null);
    assert.equal(result.claimSource, 'fallback:code-prefix');
  });

  it('uses "live" suffix when fallbackCode is empty string', () => {
    const result = extractAccountIdentity({ idToken: null, accessToken: null, fallbackCode: '' });
    assert.equal(result.email, 'live-live@codex.openai.com');
    assert.equal(result.claimSource, 'fallback:code-prefix');
  });

  it('strips special chars from fallbackCode', () => {
    const result = extractAccountIdentity({ idToken: null, accessToken: null, fallbackCode: '!!abc@#$' });
    assert.equal(result.email, 'live-abc@codex.openai.com');
  });
});
