import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validateUsageSnapshot } from '../src/validate.js';
import { buildUsageSnapshot } from '../../provider-adapters/src/shared/usage-snapshot.js';

function validSnapshot(overrides = {}) {
  return buildUsageSnapshot({
    profile: { id: 'test:a', email: 'a@x.com', accountId: 'acc-1' },
    providerId: 'test-provider',
    displayName: 'Test',
    snapshotIdPrefix: 'test',
    capturedAt: new Date('2026-04-19T00:00:00.000Z'),
    responseStatus: 200,
    ok: true,
    data: {},
    rawText: '{}',
    fields: {
      usageWindows: [{
        kind: 'primary',
        label: 'primary window',
        usedPercent: 50,
        usedAmount: null,
        limitAmount: null,
        remainingAmount: null,
        windowSeconds: null,
        resetAt: null,
      }],
      ...overrides,
    },
  });
}

describe('validateUsageSnapshot — valid data', () => {
  it('returns valid=true for a well-formed snapshot', () => {
    const result = validateUsageSnapshot(validSnapshot());
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('validates a failure snapshot from buildUsageSnapshot', () => {
    const failure = buildUsageSnapshot({
      profile: { id: 'test:b' },
      providerId: 'p',
      displayName: 'P',
      snapshotIdPrefix: 'p',
      capturedAt: new Date(),
      responseStatus: 500,
      ok: false,
      data: null,
      rawText: 'error',
      fields: {},
    });
    const result = validateUsageSnapshot(failure);
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });

  it('accepts all standard status.bucket values', () => {
    const buckets = ['ok', 'rate_limit', 'usage_window', 'billing', 'auth', 'auth_scope', 'overloaded', 'unknown'];
    for (const bucket of buckets) {
      const snap = validSnapshot();
      snap.status.bucket = bucket;
      snap.status.ok = bucket === 'ok';
      const result = validateUsageSnapshot(snap);
      assert.equal(result.valid, true, `bucket "${bucket}" should be valid. errors: ${result.errors}`);
    }
  });
});

describe('validateUsageSnapshot — required fields', () => {
  it('rejects when schemaVersion is missing', () => {
    const snap = validSnapshot();
    delete snap.schemaVersion;
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('schemaVersion')));
  });

  it('rejects when status is missing', () => {
    const snap = validSnapshot();
    delete snap.status;
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('status')));
  });

  it('rejects when provider.id is missing', () => {
    const snap = validSnapshot();
    delete snap.provider.id;
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('"id"')));
  });
});

describe('validateUsageSnapshot — enum violations', () => {
  it('rejects unknown source', () => {
    const snap = validSnapshot();
    snap.source = 'magic';
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('source') && e.includes('enum')));
  });

  it('rejects unknown authType', () => {
    const snap = validSnapshot();
    snap.authType = 'password';
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('authType')));
  });

  it('rejects unknown confidence', () => {
    const snap = validSnapshot();
    snap.confidence = 'maybe';
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('confidence')));
  });

  it('rejects unknown status.bucket', () => {
    const snap = validSnapshot();
    snap.status.bucket = 'custom_bucket';
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('bucket') && e.includes('enum')));
  });
});

describe('validateUsageSnapshot — type violations', () => {
  it('rejects non-object input', () => {
    const result = validateUsageSnapshot('not an object');
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('type')));
  });

  it('rejects null input', () => {
    const result = validateUsageSnapshot(null);
    assert.equal(result.valid, false);
  });

  it('rejects when usageWindows is not an array', () => {
    const snap = validSnapshot();
    snap.usageWindows = 'not-array';
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, false);
  });
});

describe('validateUsageSnapshot — additionalProperties', () => {
  it('rejects unexpected top-level property', () => {
    const snap = validSnapshot();
    snap.unexpectedField = 'oops';
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('unexpectedField')));
  });

  it('rejects unexpected property in status sub-object', () => {
    const snap = validSnapshot();
    snap.status.extra = true;
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('extra')));
  });

  it('allows additional properties in raw (additionalProperties: true)', () => {
    const snap = validSnapshot();
    snap.raw = { ...snap.raw, customProviderField: 'ok' };
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, true);
  });
});
