import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fetchCodexUsage } from '../../src/codex/fetch-codex-usage.js';
import { validateUsageSnapshot } from '../../../schemas/src/validate.js';

function mockResponse({ status = 200, body = {}, asText = null } = {}) {
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
  id: 'live-ac_xyz',
  accessToken: 'codex-access-token',
  accountId: null,
  email: null,
};

describe('fetchCodexUsage — request shape', () => {
  it('sends GET to wham/usage with Bearer header and User-Agent', async () => {
    let capturedUrl, capturedInit;
    const fetchImpl = async (url, init) => {
      capturedUrl = url;
      capturedInit = init;
      return mockResponse({ status: 200, body: {} });
    };

    await fetchCodexUsage(BASE_PROFILE, { fetchImpl });

    assert.equal(capturedUrl, 'https://chatgpt.com/backend-api/wham/usage');
    assert.equal(capturedInit.method, 'GET');
    assert.equal(capturedInit.headers.Authorization, 'Bearer codex-access-token');
    assert.equal(capturedInit.headers['User-Agent'], 'CodexBar');
    assert.equal(capturedInit.headers.Accept, 'application/json');
  });

  it('adds ChatGPT-Account-Id header when profile.accountId is set', async () => {
    let captured;
    const fetchImpl = async (_u, init) => {
      captured = init;
      return mockResponse({ status: 200, body: {} });
    };
    await fetchCodexUsage({ ...BASE_PROFILE, accountId: 'acc-42' }, { fetchImpl });
    assert.equal(captured.headers['ChatGPT-Account-Id'], 'acc-42');
  });

  it('omits ChatGPT-Account-Id header when profile.accountId is null', async () => {
    let captured;
    const fetchImpl = async (_u, init) => {
      captured = init;
      return mockResponse({ status: 200, body: {} });
    };
    await fetchCodexUsage(BASE_PROFILE, { fetchImpl });
    assert.equal('ChatGPT-Account-Id' in captured.headers, false);
  });

  it('propagates timeoutMs option to fetchWithTimeout (non-null AbortSignal)', async () => {
    let captured;
    const fetchImpl = async (_u, init) => {
      captured = init;
      return mockResponse({ status: 200, body: {} });
    };
    await fetchCodexUsage(BASE_PROFILE, { fetchImpl, timeoutMs: 1000 });
    assert.ok(captured.signal);
  });
});

describe('fetchCodexUsage — snapshot on 200', () => {
  const RESPONSE_BODY = {
    plan_type: 'plus',
    rate_limit: {
      primary_window: { used_percent: 25, limit_window_seconds: 18000, reset_at: 1700000000 },
      secondary_window: { used_percent: 80, limit_window_seconds: 604800, reset_at: 1700604800 },
    },
    credits: { balance: 100 },
  };

  async function run() {
    const fetchImpl = async () => mockResponse({ status: 200, body: RESPONSE_BODY });
    return fetchCodexUsage(BASE_PROFILE, { fetchImpl });
  }

  it('has provider.id openai-codex, confidence=high, bucket=ok', async () => {
    const snap = await run();
    assert.equal(snap.provider.id, 'openai-codex');
    assert.equal(snap.status.ok, true);
    assert.equal(snap.status.bucket, 'ok');
    assert.equal(snap.confidence, 'high');
  });

  it('normalizes primary and secondary windows', async () => {
    const snap = await run();
    const primary = snap.usageWindows.find((w) => w.kind === 'primary');
    const secondary = snap.usageWindows.find((w) => w.kind === 'secondary');
    assert.ok(primary);
    assert.equal(primary.usedPercent, 25);
    assert.equal(primary.windowSeconds, 18000);
    assert.match(primary.resetAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(secondary);
    assert.equal(secondary.usedPercent, 80);
  });

  it('includes account.plan from plan_type and credits.balance', async () => {
    const snap = await run();
    assert.equal(snap.account.plan, 'plus');
    assert.equal(snap.credits.balance, 100);
  });

  it('skips windows when absent', async () => {
    const fetchImpl = async () => mockResponse({ status: 200, body: {} });
    const snap = await fetchCodexUsage(BASE_PROFILE, { fetchImpl });
    assert.deepEqual(snap.usageWindows, []);
  });
});

describe('fetchCodexUsage — error status buckets', () => {
  async function runStatus(status, bodyOrText = {}) {
    const fetchImpl = async () =>
      typeof bodyOrText === 'string'
        ? mockResponse({ status, asText: bodyOrText })
        : mockResponse({ status, body: bodyOrText });
    return fetchCodexUsage(BASE_PROFILE, { fetchImpl });
  }

  it('maps 401 → auth', async () => {
    assert.equal((await runStatus(401)).status.bucket, 'auth');
  });

  it('maps 402 → billing', async () => {
    assert.equal((await runStatus(402)).status.bucket, 'billing');
  });

  it('maps 429 → rate_limit', async () => {
    assert.equal((await runStatus(429)).status.bucket, 'rate_limit');
  });

  it('maps 5xx → overloaded', async () => {
    assert.equal((await runStatus(502)).status.bucket, 'overloaded');
    assert.equal((await runStatus(500)).status.bucket, 'overloaded');
  });

  it('defaults to unknown for other statuses', async () => {
    assert.equal((await runStatus(418)).status.bucket, 'unknown');
  });

  it('returns empty usageWindows and includes message on error', async () => {
    const snap = await runStatus(500, 'boom');
    assert.deepEqual(snap.usageWindows, []);
    assert.equal(snap.status.message, 'boom');
    assert.equal(snap.confidence, 'medium');
  });

  it('handles non-JSON body gracefully', async () => {
    const snap = await runStatus(500, 'upstream plain text');
    assert.equal(snap.status.ok, false);
    assert.equal(snap.status.message, 'upstream plain text');
  });
});

describe('fetchCodexUsage — schema compliance', () => {
  it('success snapshot passes schema validation', async () => {
    const fetchImpl = async () => mockResponse({
      status: 200,
      body: { plan_type: 'plus', rate_limit: { primary_window: { used_percent: 0, reset_at: 1700000000 } } },
    });
    const snap = await fetchCodexUsage(BASE_PROFILE, { fetchImpl });
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });

  it('failure snapshot passes schema validation', async () => {
    const fetchImpl = async () => mockResponse({ status: 500, asText: 'server error' });
    const snap = await fetchCodexUsage(BASE_PROFILE, { fetchImpl });
    const result = validateUsageSnapshot(snap);
    assert.equal(result.valid, true, `errors: ${result.errors.join(', ')}`);
  });
});
