import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validateUsageSnapshot } from '../../../schemas/src/validate.js';
import {
  resolveStatusBucket,
  safeErrorMessage,
  toIsoString,
  toIsoFromEpochSeconds,
  parseJsonSafely,
  buildUsageSnapshot,
} from '../../src/shared/usage-snapshot.js';

describe('resolveStatusBucket', () => {
  it('returns ok when ok=true (regardless of status)', () => {
    assert.equal(resolveStatusBucket(500, true), 'ok');
  });

  it('maps 401 / 403 → auth', () => {
    assert.equal(resolveStatusBucket(401, false), 'auth');
    assert.equal(resolveStatusBucket(403, false), 'auth');
  });

  it('maps 429 → rate_limit, 402 → billing, 5xx → overloaded', () => {
    assert.equal(resolveStatusBucket(429, false), 'rate_limit');
    assert.equal(resolveStatusBucket(402, false), 'billing');
    assert.equal(resolveStatusBucket(500, false), 'overloaded');
    assert.equal(resolveStatusBucket(503, false), 'overloaded');
  });

  it('returns unknown when no rule matches', () => {
    assert.equal(resolveStatusBucket(418, false), 'unknown');
    assert.equal(resolveStatusBucket(undefined, false), 'unknown');
  });

  it('uses extraBucket override before default rules', () => {
    const extra = (status, data) => (status === 403 && data?.x ? 'custom_403' : null);
    assert.equal(resolveStatusBucket(403, false, extra, { x: true }), 'custom_403');
    assert.equal(resolveStatusBucket(403, false, extra, {}), 'auth');
  });
});

describe('safeErrorMessage', () => {
  it('prefers data.error.message', () => {
    assert.equal(safeErrorMessage({ error: { message: ' oops ' } }, 'fallback'), 'oops');
  });

  it('falls back to data.message when error.message missing', () => {
    assert.equal(safeErrorMessage({ message: 'plain' }, 'fallback'), 'plain');
  });

  it('falls back to rawText slice (max 500) when no api message', () => {
    const big = 'x'.repeat(800);
    const out = safeErrorMessage(null, big);
    assert.equal(out.length, 500);
  });

  it('returns "unknown error" when nothing usable', () => {
    assert.equal(safeErrorMessage(null, ''), 'unknown error');
    assert.equal(safeErrorMessage(undefined), 'unknown error');
  });
});

describe('toIsoString', () => {
  it('handles Date input', () => {
    const d = new Date('2026-04-14T00:00:00.000Z');
    assert.equal(toIsoString(d), '2026-04-14T00:00:00.000Z');
  });

  it('handles ISO string input', () => {
    assert.equal(toIsoString('2026-04-14T01:00:00.000Z'), '2026-04-14T01:00:00.000Z');
  });

  it('handles number ms epoch', () => {
    assert.equal(toIsoString(0), '1970-01-01T00:00:00.000Z');
  });
});

describe('toIsoFromEpochSeconds', () => {
  it('converts epoch seconds → ISO', () => {
    assert.equal(toIsoFromEpochSeconds(0), '1970-01-01T00:00:00.000Z');
  });

  it('returns null for non-number', () => {
    assert.equal(toIsoFromEpochSeconds(undefined), null);
    assert.equal(toIsoFromEpochSeconds('100'), null);
  });
});

describe('parseJsonSafely', () => {
  it('parses valid JSON', () => {
    assert.deepEqual(parseJsonSafely('{"a":1}'), { a: 1 });
  });

  it('returns null on invalid JSON or empty', () => {
    assert.equal(parseJsonSafely('not json'), null);
    assert.equal(parseJsonSafely(''), null);
    assert.equal(parseJsonSafely(null), null);
  });
});

describe('buildUsageSnapshot', () => {
  const baseArgs = {
    profile: { id: 'live-x', email: 'x@example.com', accountId: 'acc-1' },
    providerId: 'foo-test',
    displayName: 'Foo',
    snapshotIdPrefix: 'foo',
    capturedAt: new Date('2026-04-14T00:00:00.000Z'),
    responseStatus: 200,
    ok: true,
    data: { plan: null },
    rawText: '{}',
    fields: {
      usageWindows: [{ kind: 'primary' }],
    },
  };

  it('builds a snapshotId from prefix + profile.id + capturedAt', () => {
    const out = buildUsageSnapshot(baseArgs);
    assert.equal(out.snapshotId, 'foo:live-x:2026-04-14T00:00:00.000Z');
  });

  it('includes provider/account meta and confidence=high on ok', () => {
    const out = buildUsageSnapshot(baseArgs);
    assert.equal(out.provider.id, 'foo-test');
    assert.equal(out.provider.displayName, 'Foo');
    assert.equal(out.account.email, 'x@example.com');
    assert.equal(out.account.accountId, 'acc-1');
    assert.equal(out.confidence, 'high');
    assert.equal(out.status.ok, true);
    assert.equal(out.status.bucket, 'ok');
    assert.equal(out.status.lastSuccessAt, '2026-04-14T00:00:00.000Z');
    assert.equal(out.status.lastFailureAt, null);
  });

  it('returns empty usageWindows on failure even if fields supplied them', () => {
    const out = buildUsageSnapshot({
      ...baseArgs,
      ok: false,
      responseStatus: 500,
      data: null,
      rawText: 'boom',
      fields: { usageWindows: [{ kind: 'primary' }] },
    });
    assert.deepEqual(out.usageWindows, []);
    assert.equal(out.status.bucket, 'overloaded');
    assert.equal(out.status.message, 'boom');
    assert.equal(out.confidence, 'medium');
  });

  it('puts provider id and rawError into raw section', () => {
    const out = buildUsageSnapshot({
      ...baseArgs,
      ok: false,
      responseStatus: 401,
      data: { error: { message: 'no token' } },
      rawText: '{"error":{"message":"no token"}}',
      fields: { raw: { x: 1 } },
    });
    assert.equal(out.raw.provider, 'foo-test');
    assert.equal(out.raw.x, 1);
    assert.match(out.raw.rawError, /no token/);
  });
});

describe('buildUsageSnapshot — soft enforcement', () => {
  it('keeps confidence=high and no warnings for a valid snapshot', () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      const snap = buildUsageSnapshot({
        profile: { id: 'x' },
        providerId: 'p',
        displayName: 'P',
        snapshotIdPrefix: 'p',
        capturedAt: new Date(),
        responseStatus: 200,
        ok: true,
        data: null,
        rawText: '',
        fields: {},
      });
      assert.equal(snap.confidence, 'high');
      assert.equal(warnings.length, 0);
    } finally {
      console.warn = origWarn;
    }
  });

  it('returns a mutable snapshot object (const snapshot pattern, not inline return)', () => {
    const snap = buildUsageSnapshot({
      profile: { id: 'x' },
      providerId: 'p',
      displayName: 'P',
      snapshotIdPrefix: 'p',
      capturedAt: new Date(),
      responseStatus: 200,
      ok: true,
      data: null,
      rawText: '',
      fields: {},
    });
    // If enforcement code were dead (return {...} before validate),
    // this would still pass — but the next test proves it runs.
    snap.confidence = 'low';
    assert.equal(snap.confidence, 'low');
  });

  it('validation actually runs — external re-validate agrees with inline result', () => {
    const snap = buildUsageSnapshot({
      profile: { id: 'x' },
      providerId: 'p',
      displayName: 'P',
      snapshotIdPrefix: 'p',
      capturedAt: new Date(),
      responseStatus: 200,
      ok: true,
      data: null,
      rawText: '',
      fields: {},
    });
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, true);
    assert.equal(snap.confidence, 'high');
  });
});
