import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatTokenExpiry, formatRefreshSuccess } from '../../src/cli/doctor-helpers.js';

describe('formatTokenExpiry', () => {
  it('returns null when expiresAtIso is missing or invalid', () => {
    assert.equal(formatTokenExpiry(null), null);
    assert.equal(formatTokenExpiry(undefined), null);
    assert.equal(formatTokenExpiry('not-a-date'), null);
  });

  it('returns expired message when token is past', () => {
    const past = new Date('2020-01-01T00:00:00.000Z').toISOString();
    const out = formatTokenExpiry(past, new Date('2026-04-14T00:00:00.000Z'));
    assert.match(out, /만료되었습니다/);
    assert.match(out, /2020-01-01/);
  });

  it('returns "remaining N min" when token is in future', () => {
    const future = new Date('2026-04-14T01:00:00.000Z').toISOString();
    const now = new Date('2026-04-14T00:00:00.000Z');
    assert.equal(formatTokenExpiry(future, now), '토큰 만료까지 약 60분 남음.');
  });
});

describe('formatRefreshSuccess', () => {
  it('lists token_type / expires_in / scope', () => {
    const lines = formatRefreshSuccess(
      { tokenType: 'Bearer', expiresIn: 3600, scope: 'a b', refreshToken: 'rt' },
      'rt',
    );
    assert.ok(lines.some((l) => l.includes('token_type: Bearer')));
    assert.ok(lines.some((l) => l.includes('expires_in: 3600')));
    assert.ok(lines.some((l) => l.includes('scope: a b')));
  });

  it('shows rotation when refreshToken changed', () => {
    const lines = formatRefreshSuccess(
      { tokenType: 'Bearer', expiresIn: 1, scope: null, refreshToken: 'new-rt' },
      'old-rt',
    );
    assert.ok(lines.some((l) => l.includes('rotation')));
  });

  it('shows kept message when refreshToken unchanged', () => {
    const lines = formatRefreshSuccess(
      { tokenType: 'Bearer', expiresIn: 1, scope: null, refreshToken: 'same' },
      'same',
    );
    assert.ok(lines.some((l) => l.includes('기존 유지')));
  });

  it('handles null scope', () => {
    const lines = formatRefreshSuccess(
      { tokenType: 'Bearer', expiresIn: 1, scope: null, refreshToken: null },
      null,
    );
    assert.ok(lines.some((l) => l.includes('scope: (없음)')));
  });
});
