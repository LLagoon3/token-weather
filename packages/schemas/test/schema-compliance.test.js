import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { buildUsageSnapshot } from '../../provider-adapters/src/shared/usage-snapshot.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const snapshotSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../usage-snapshot.schema.json'), 'utf8'),
);

function makeSampleSnapshot(overrides = {}) {
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
      usageWindows: [
        {
          kind: 'primary',
          label: 'primary window',
          usedPercent: 50,
          usedAmount: null,
          limitAmount: null,
          remainingAmount: null,
          windowSeconds: null,
          resetAt: null,
        },
      ],
      ...overrides,
    },
  });
}

function makeSampleFailureSnapshot() {
  return buildUsageSnapshot({
    profile: { id: 'test:b', email: null, accountId: null },
    providerId: 'test-provider',
    displayName: 'Test',
    snapshotIdPrefix: 'test',
    capturedAt: new Date('2026-04-19T00:00:00.000Z'),
    responseStatus: 500,
    ok: false,
    data: null,
    rawText: 'server error',
    fields: {},
  });
}

describe('buildUsageSnapshot — key set alignment with schema', () => {
  it('top-level keys match schema properties exactly', () => {
    const snapshot = makeSampleSnapshot();
    const snapshotKeys = Object.keys(snapshot).sort();
    const schemaKeys = Object.keys(snapshotSchema.properties).sort();
    assert.deepEqual(snapshotKeys, schemaKeys);
  });

  it('provider sub-object keys match schema', () => {
    const snapshot = makeSampleSnapshot();
    const actual = Object.keys(snapshot.provider).sort();
    const expected = Object.keys(snapshotSchema.properties.provider.properties).sort();
    assert.deepEqual(actual, expected);
  });

  it('account sub-object keys match schema', () => {
    const snapshot = makeSampleSnapshot();
    const actual = Object.keys(snapshot.account).sort();
    const expected = Object.keys(snapshotSchema.properties.account.properties).sort();
    assert.deepEqual(actual, expected);
  });

  it('status sub-object keys match schema', () => {
    const snapshot = makeSampleSnapshot();
    const actual = Object.keys(snapshot.status).sort();
    const expected = Object.keys(snapshotSchema.properties.status.properties).sort();
    assert.deepEqual(actual, expected);
  });

  it('usageWindow item keys match schema', () => {
    const snapshot = makeSampleSnapshot();
    const windowItem = snapshot.usageWindows[0];
    const actual = Object.keys(windowItem).sort();
    const expected = Object.keys(snapshotSchema.properties.usageWindows.items.properties).sort();
    assert.deepEqual(actual, expected);
  });

  it('all required fields are present', () => {
    const snapshot = makeSampleSnapshot();
    for (const key of snapshotSchema.required) {
      assert.ok(key in snapshot, `required field "${key}" is missing`);
    }
  });
});

describe('failure snapshot — same key set as success snapshot', () => {
  it('failure snapshot has identical top-level keys', () => {
    const success = makeSampleSnapshot();
    const failure = makeSampleFailureSnapshot();
    assert.deepEqual(Object.keys(failure).sort(), Object.keys(success).sort());
  });

  it('failure snapshot passes same schema required fields', () => {
    const failure = makeSampleFailureSnapshot();
    for (const key of snapshotSchema.required) {
      assert.ok(key in failure, `required field "${key}" missing in failure snapshot`);
    }
  });
});

describe('enum compliance', () => {
  it('source is within schema enum', () => {
    const snapshot = makeSampleSnapshot();
    const allowed = snapshotSchema.properties.source.enum;
    assert.ok(
      allowed.includes(snapshot.source),
      `source "${snapshot.source}" not in enum ${allowed}`,
    );
  });

  it('authType is within schema enum', () => {
    const snapshot = makeSampleSnapshot();
    const allowed = snapshotSchema.properties.authType.enum;
    assert.ok(
      allowed.includes(snapshot.authType),
      `authType "${snapshot.authType}" not in ${allowed}`,
    );
  });

  it('confidence is within schema enum', () => {
    for (const ok of [true, false]) {
      const snapshot = buildUsageSnapshot({
        profile: { id: 'x' },
        providerId: 'p',
        displayName: 'P',
        snapshotIdPrefix: 'p',
        capturedAt: new Date(),
        responseStatus: ok ? 200 : 500,
        ok,
        data: null,
        rawText: '',
        fields: {},
      });
      const allowed = snapshotSchema.properties.confidence.enum;
      assert.ok(
        allowed.includes(snapshot.confidence),
        `confidence "${snapshot.confidence}" not in ${allowed}`,
      );
    }
  });

  it('status.bucket is within schema enum for standard buckets', () => {
    const allowed = snapshotSchema.properties.status.properties.bucket.enum;
    for (const status of [200, 401, 402, 403, 429, 500]) {
      const snapshot = buildUsageSnapshot({
        profile: { id: 'x' },
        providerId: 'p',
        displayName: 'P',
        snapshotIdPrefix: 'p',
        capturedAt: new Date(),
        responseStatus: status,
        ok: status === 200,
        data: null,
        rawText: '',
        fields: {},
      });
      assert.ok(
        allowed.includes(snapshot.status.bucket),
        `bucket "${snapshot.status.bucket}" for status ${status} not in ${allowed}`,
      );
    }
  });

  it('auth_scope bucket (Claude specific) is in schema enum', () => {
    const allowed = snapshotSchema.properties.status.properties.bucket.enum;
    assert.ok(allowed.includes('auth_scope'), 'auth_scope should be in schema enum');
  });
});
