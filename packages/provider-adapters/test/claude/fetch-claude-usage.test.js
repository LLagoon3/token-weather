import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fetchClaudeUsage } from '../../src/claude/fetch-claude-usage.js';
import { validateUsageSnapshot } from '../../../schemas/src/validate.js';

function createMockResponse({ status = 200, body = {}, asText = null } = {}) {
  const text = asText !== null ? asText : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() {
      return text;
    },
  };
}

const BASE_PROFILE = {
  id: 'claude-cli-import',
  accessToken: 'sk-ant-test-token',
  accountId: null,
  email: null,
};

describe('fetchClaudeUsage', () => {
  it('sends required OAuth headers to api.anthropic.com/api/oauth/usage', async () => {
    let capturedUrl = null;
    let capturedInit = null;
    const fetchImpl = async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return createMockResponse({ status: 200, body: {} });
    };

    await fetchClaudeUsage(BASE_PROFILE, { fetchImpl });

    assert.equal(capturedUrl, 'https://api.anthropic.com/api/oauth/usage');
    assert.equal(capturedInit.method, 'GET');
    assert.equal(capturedInit.headers.Authorization, 'Bearer sk-ant-test-token');
    assert.equal(capturedInit.headers['anthropic-version'], '2023-06-01');
    assert.equal(capturedInit.headers['anthropic-beta'], 'oauth-2025-04-20');
    assert.equal(capturedInit.headers.Accept, 'application/json');
  });

  it('returns a snapshot with provider id anthropic-claude and ok status on 200', async () => {
    const fetchImpl = async () =>
      createMockResponse({
        status: 200,
        body: {
          five_hour: { utilization: 0.25, resets_at: '2026-04-14T14:00:00.000Z' },
          seven_day: { utilization: 0.75, resets_at: '2026-04-20T00:00:00.000Z' },
        },
      });

    const snapshot = await fetchClaudeUsage(BASE_PROFILE, { fetchImpl });

    assert.equal(snapshot.provider.id, 'anthropic-claude');
    assert.equal(snapshot.status.ok, true);
    assert.equal(snapshot.status.bucket, 'ok');
    assert.equal(snapshot.status.httpStatus, 200);
    assert.equal(snapshot.source, 'provider_usage_endpoint');
    assert.equal(snapshot.authType, 'oauth');
    assert.equal(snapshot.confidence, 'high');
  });

  it('normalizes five_hour and seven_day into usageWindows with percent scaled to 0-100', async () => {
    const fetchImpl = async () =>
      createMockResponse({
        status: 200,
        body: {
          five_hour: { utilization: 0.25, resets_at: '2026-04-14T14:00:00.000Z' },
          seven_day: { utilization: 0.75, resets_at: '2026-04-20T00:00:00.000Z' },
        },
      });

    const snapshot = await fetchClaudeUsage(BASE_PROFILE, { fetchImpl });

    const fiveHour = snapshot.usageWindows.find((w) => w.kind === 'five_hour');
    const sevenDay = snapshot.usageWindows.find((w) => w.kind === 'seven_day');

    assert.ok(fiveHour);
    assert.equal(fiveHour.usedPercent, 25);
    assert.equal(fiveHour.resetAt, '2026-04-14T14:00:00.000Z');

    assert.ok(sevenDay);
    assert.equal(sevenDay.usedPercent, 75);
  });

  it('normalizes sonnet and opus weekly windows when present', async () => {
    const fetchImpl = async () =>
      createMockResponse({
        status: 200,
        body: {
          seven_day_sonnet: { utilization: 0.4 },
          seven_day_opus: { utilization: 0.1 },
        },
      });

    const snapshot = await fetchClaudeUsage(BASE_PROFILE, { fetchImpl });

    const sonnet = snapshot.usageWindows.find((w) => w.kind === 'seven_day_sonnet');
    const opus = snapshot.usageWindows.find((w) => w.kind === 'seven_day_opus');

    assert.ok(sonnet);
    assert.equal(sonnet.usedPercent, 40);
    assert.ok(opus);
    assert.equal(opus.usedPercent, 10);
  });

  it('accepts utilization values already expressed as 0-100 without double-scaling', async () => {
    const fetchImpl = async () =>
      createMockResponse({
        status: 200,
        body: {
          five_hour: { utilization: 50 },
        },
      });

    const snapshot = await fetchClaudeUsage(BASE_PROFILE, { fetchImpl });
    const fiveHour = snapshot.usageWindows[0];
    assert.equal(fiveHour.usedPercent, 50);
  });

  it('returns empty usageWindows and error message on 401', async () => {
    const fetchImpl = async () =>
      createMockResponse({
        status: 401,
        body: { error: { message: 'invalid token' } },
      });

    const snapshot = await fetchClaudeUsage(BASE_PROFILE, { fetchImpl });

    assert.equal(snapshot.status.ok, false);
    assert.equal(snapshot.status.httpStatus, 401);
    assert.equal(snapshot.status.bucket, 'auth');
    assert.equal(snapshot.status.message, 'invalid token');
    assert.deepEqual(snapshot.usageWindows, []);
  });

  it('maps 403 scope errors to auth_scope bucket', async () => {
    const fetchImpl = async () =>
      createMockResponse({
        status: 403,
        body: { error: { message: 'missing scope requirement user:profile' } },
      });

    const snapshot = await fetchClaudeUsage(BASE_PROFILE, { fetchImpl });
    assert.equal(snapshot.status.bucket, 'auth_scope');
  });

  it('maps 429 to rate_limit bucket', async () => {
    const fetchImpl = async () => createMockResponse({ status: 429, body: {} });
    const snapshot = await fetchClaudeUsage(BASE_PROFILE, { fetchImpl });
    assert.equal(snapshot.status.bucket, 'rate_limit');
  });

  it('handles non-JSON error bodies gracefully', async () => {
    const fetchImpl = async () =>
      createMockResponse({ status: 502, asText: 'upstream error page' });

    const snapshot = await fetchClaudeUsage(BASE_PROFILE, { fetchImpl });
    assert.equal(snapshot.status.ok, false);
    assert.equal(snapshot.status.bucket, 'overloaded');
    assert.equal(snapshot.status.message, 'upstream error page');
  });

  it('includes email and accountId from profile in account section', async () => {
    const fetchImpl = async () => createMockResponse({ status: 200, body: {} });
    const snapshot = await fetchClaudeUsage(
      { ...BASE_PROFILE, email: 'user@example.com', accountId: 'acc-123' },
      { fetchImpl },
    );
    assert.equal(snapshot.account.email, 'user@example.com');
    assert.equal(snapshot.account.accountId, 'acc-123');
    assert.equal(snapshot.account.profileId, 'claude-cli-import');
  });
});

describe('fetchClaudeUsage — schema compliance', () => {
  it('success snapshot passes schema validation', async () => {
    const fetchImpl = async () => createMockResponse({
      status: 200,
      body: { five_hour: { utilization: 0.25, resets_at: '2026-04-19T00:00:00Z' } },
    });
    const snap = await fetchClaudeUsage(BASE_PROFILE, { fetchImpl });
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });

  it('failure snapshot passes schema validation', async () => {
    const fetchImpl = async () => createMockResponse({ status: 401, body: { error: { message: 'invalid' } } });
    const snap = await fetchClaudeUsage(BASE_PROFILE, { fetchImpl });
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });

  it('auth_scope bucket passes schema validation', async () => {
    const fetchImpl = async () => createMockResponse({
      status: 403,
      body: { error: { message: 'missing scope requirement user:profile' } },
    });
    const snap = await fetchClaudeUsage(BASE_PROFILE, { fetchImpl });
    assert.equal(snap.status.bucket, 'auth_scope');
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });
});
