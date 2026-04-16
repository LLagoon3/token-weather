import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createMockCodexAccountFromManualInput } from '../../src/auth/mock-auth-exchange.js';

describe('createMockCodexAccountFromManualInput', () => {
  it('derives accountKey from the sanitized code prefix (email-like)', () => {
    const account = createMockCodexAccountFromManualInput({
      code: 'abcDEF12345xyz',
      rawInput: 'callback-url-or-code',
    });
    assert.equal(account.accountKey, 'openai-codex:manual-abcdef12@example.local');
    assert.equal(account.email, 'manual-abcdef12@example.local');
  });

  it('falls back to "manual" suffix when code is empty or pure-punctuation', () => {
    const a = createMockCodexAccountFromManualInput({ code: '', rawInput: 'x' });
    assert.ok(a.accountKey.includes('manual-manual'));
    const b = createMockCodexAccountFromManualInput({ code: '!!!@@@###', rawInput: 'x' });
    assert.ok(b.accountKey.includes('manual-manual'));
  });

  it('strips non-[a-zA-Z0-9_-] characters from code', () => {
    const account = createMockCodexAccountFromManualInput({
      code: 'a b*c!d#e',
      rawInput: 'x',
    });
    assert.ok(account.accountKey.includes('manual-abcde'));
  });

  it('marks the account as mock with raw.mock=true and source=manual', () => {
    const account = createMockCodexAccountFromManualInput({
      code: 'abcd',
      rawInput: 'x',
    });
    assert.equal(account.raw.mock, true);
    assert.equal(account.source, 'manual');
    assert.equal(account.raw.provider, 'openai-codex');
  });

  it('generates mock tokens following the accessToken/refreshToken convention', () => {
    const account = createMockCodexAccountFromManualInput({
      code: 'abcd',
      rawInput: 'x',
    });
    assert.match(account.tokens.accessToken, /^mock-access-token-/);
    assert.match(account.tokens.refreshToken, /^mock-refresh-token-/);
  });

  it('truncates manualInputPreview to 120 chars', () => {
    const long = 'x'.repeat(500);
    const account = createMockCodexAccountFromManualInput({
      code: 'abcd',
      rawInput: long,
    });
    assert.equal(account.raw.manualInputPreview.length, 120);
  });

  it('preserves original code case in accountKey via lower-casing', () => {
    // sanitize lower-cases, so 'AbCd' → 'abcd'
    const account = createMockCodexAccountFromManualInput({
      code: 'AbCd1234',
      rawInput: 'x',
    });
    assert.ok(account.accountKey.includes('manual-abcd1234'));
  });
});
