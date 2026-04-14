import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateState,
  generatePkce,
  buildCallbackUrl,
} from '../../src/auth/localhost-callback.js';

describe('generateState', () => {
  it('returns a base64url string with default 32 bytes (≈43 chars)', () => {
    const state = generateState();
    assert.match(state, /^[A-Za-z0-9_-]+$/);
    assert.ok(state.length >= 40 && state.length <= 48);
  });

  it('subsequent calls produce different values', () => {
    const a = generateState();
    const b = generateState();
    assert.notEqual(a, b);
  });

  it('honors the bytes argument for length', () => {
    const short = generateState(8);
    const long = generateState(64);
    assert.ok(short.length < long.length);
  });
});

describe('generatePkce', () => {
  it('returns codeVerifier, codeChallenge, and S256 method', () => {
    const { codeVerifier, codeChallenge, codeChallengeMethod } = generatePkce();
    assert.equal(codeChallengeMethod, 'S256');
    assert.match(codeVerifier, /^[A-Za-z0-9_-]+$/);
    assert.match(codeChallenge, /^[A-Za-z0-9_-]+$/);
    assert.notEqual(codeVerifier, codeChallenge);
  });

  it('codeChallenge is deterministic from verifier (same input → same hash)', () => {
    const a = generatePkce();
    // SHA-256 의 base64url 길이는 43
    assert.equal(a.codeChallenge.length, 43);
  });
});

describe('buildCallbackUrl', () => {
  it('defaults to /auth/callback path (Codex 기본)', () => {
    assert.equal(buildCallbackUrl(1455), 'http://localhost:1455/auth/callback');
  });

  it('honors custom path (Claude: /callback)', () => {
    assert.equal(buildCallbackUrl(1455, '/callback'), 'http://localhost:1455/callback');
  });

  it('uses the provided port in the URL', () => {
    assert.equal(buildCallbackUrl(38123, '/x'), 'http://localhost:38123/x');
  });
});
