import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { extractCodeFromPaste } from '../../src/auth/manual-paste.js';

describe('extractCodeFromPaste — error envelope', () => {
  it('propagates error from pasteResult', () => {
    const out = extractCodeFromPaste({ type: 'code', value: '', error: 'empty-input' });
    assert.equal(out.code, null);
    assert.equal(out.state, null);
    assert.equal(out.error, 'empty-input');
  });
});

describe('extractCodeFromPaste — type=code', () => {
  it('returns the raw code string as-is', () => {
    const out = extractCodeFromPaste({ type: 'code', value: 'ac_abc123' });
    assert.equal(out.code, 'ac_abc123');
    assert.equal(out.state, null);
    assert.equal(out.error, null);
  });

  it('handles arbitrary string input (trimmed upstream)', () => {
    const out = extractCodeFromPaste({ type: 'code', value: 'odd  value 🎉' });
    assert.equal(out.code, 'odd  value 🎉');
    assert.equal(out.error, null);
  });
});

describe('extractCodeFromPaste — type=url', () => {
  it('extracts code + state from a valid callback URL', () => {
    const out = extractCodeFromPaste({
      type: 'url',
      value: 'http://localhost:1455/auth/callback?code=abc&state=xyz',
    });
    assert.equal(out.code, 'abc');
    assert.equal(out.state, 'xyz');
    assert.equal(out.error, null);
  });

  it('returns no-code-in-url when URL has no code param', () => {
    const out = extractCodeFromPaste({
      type: 'url',
      value: 'http://localhost/auth/callback?state=xyz',
    });
    assert.equal(out.code, null);
    assert.equal(out.state, 'xyz');
    assert.equal(out.error, 'no-code-in-url');
  });

  it('returns invalid-url for garbage input labeled as url', () => {
    const out = extractCodeFromPaste({ type: 'url', value: 'not-a-url' });
    assert.equal(out.code, null);
    assert.equal(out.error, 'invalid-url');
  });

  it('preserves additional query params intact (code still extracted)', () => {
    const out = extractCodeFromPaste({
      type: 'url',
      value:
        'http://localhost:1455/auth/callback?scope=openid+email&code=ac_42&state=st1',
    });
    assert.equal(out.code, 'ac_42');
    assert.equal(out.state, 'st1');
    assert.equal(out.error, null);
  });

  it('treats https URLs equally', () => {
    const out = extractCodeFromPaste({
      type: 'url',
      value: 'https://example.com/cb?code=c',
    });
    assert.equal(out.code, 'c');
    assert.equal(out.error, null);
  });
});
