import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { findLegacyDuplicates } from '../../src/auth/find-legacy-duplicates.js';

// base64url for { "sub": "google-oauth2|115", "email": "a@x.com" }
const JWT_SUB_A = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJnb29nbGUtb2F1dGgyfDExNSIsImVtYWlsIjoiYUB4LmNvbSJ9.';

describe('findLegacyDuplicates — empty inputs', () => {
  it('returns [] when existingAccounts is empty', () => {
    const out = findLegacyDuplicates([], { accountKey: 'x', accountId: 's' });
    assert.deepEqual(out, []);
  });

  it('returns [] when newAccount is null', () => {
    assert.deepEqual(findLegacyDuplicates([{ accountKey: 'a' }], null), []);
  });

  it('returns [] when newAccount has no identity (sub/email)', () => {
    const out = findLegacyDuplicates(
      [{ accountKey: 'a', accountId: 's-existing' }],
      { accountKey: 'b' },
    );
    assert.deepEqual(out, []);
  });
});

describe('findLegacyDuplicates — sub matching', () => {
  it('finds existing account with same accountId (sub)', () => {
    const existing = [
      { accountKey: 'openai-codex:google-oauth2|115', accountId: 'google-oauth2|115', email: 'a@x.com' },
      { accountKey: 'openai-codex:other', accountId: 'google-oauth2|999', email: 'z@x.com' },
    ];
    const newAccount = {
      accountKey: 'openai-codex:google-oauth2|115-new',
      accountId: 'google-oauth2|115',
      email: 'a@x.com',
    };
    const out = findLegacyDuplicates(existing, newAccount);
    assert.equal(out.length, 1);
    assert.equal(out[0].accountKey, 'openai-codex:google-oauth2|115');
    assert.equal(out[0].reason, 'same-sub');
  });

  it('excludes same accountKey (upsert case)', () => {
    const existing = [
      { accountKey: 'same', accountId: 'sub1', email: 'a@x.com' },
    ];
    const newAccount = { accountKey: 'same', accountId: 'sub1', email: 'a@x.com' };
    assert.deepEqual(findLegacyDuplicates(existing, newAccount), []);
  });

  it('decodes idToken to find sub when accountId is missing (legacy case)', () => {
    const existing = [
      {
        accountKey: 'openai-codex:live-abc@codex.openai.com',
        email: 'live-abc@codex.openai.com',
        accountId: null,
        raw: { idToken: JWT_SUB_A },
      },
    ];
    const newAccount = {
      accountKey: 'openai-codex:google-oauth2|115',
      accountId: 'google-oauth2|115',
      email: 'a@x.com',
    };
    const out = findLegacyDuplicates(existing, newAccount);
    assert.equal(out.length, 1);
    assert.equal(out[0].reason, 'same-sub');
  });
});

describe('findLegacyDuplicates — email matching', () => {
  it('matches by email when neither has sub', () => {
    const existing = [
      { accountKey: 'a', email: 'a@x.com' },
    ];
    const newAccount = { accountKey: 'a-new', email: 'A@X.com' };
    const out = findLegacyDuplicates(existing, newAccount);
    assert.equal(out.length, 1);
    assert.equal(out[0].reason, 'same-email');
  });

  it('does NOT match synthetic fallback emails (live-xxxx@...) even if equal literally', () => {
    // newAccount email is synthetic — we strip it so no false-positive
    const existing = [{ accountKey: 'a', email: 'live-code@codex.openai.com' }];
    const newAccount = { accountKey: 'b', email: 'live-code@codex.openai.com' };
    assert.deepEqual(findLegacyDuplicates(existing, newAccount), []);
  });

  it('returns [] when emails differ and no sub', () => {
    const existing = [{ accountKey: 'a', email: 'a@x.com' }];
    const newAccount = { accountKey: 'b', email: 'b@x.com' };
    assert.deepEqual(findLegacyDuplicates(existing, newAccount), []);
  });
});

describe('findLegacyDuplicates — priority', () => {
  it('sub match wins over email match when both apply', () => {
    const existing = [
      {
        accountKey: 'a',
        accountId: 'sub1',
        email: 'a@x.com',
      },
    ];
    const newAccount = {
      accountKey: 'a-new',
      accountId: 'sub1',
      email: 'a@x.com',
    };
    const out = findLegacyDuplicates(existing, newAccount);
    assert.equal(out.length, 1);
    assert.equal(out[0].reason, 'same-sub');
  });
});
