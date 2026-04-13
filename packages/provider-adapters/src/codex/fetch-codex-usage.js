import { SCHEMA_VERSION } from '../../../schemas/src/index.js';

export async function fetchCodexUsage(profile, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const capturedAt = options.capturedAt ?? new Date();

  const headers = {
    Authorization: `Bearer ${profile.accessToken}`,
    Accept: 'application/json',
    'User-Agent': 'CodexBar'
  };

  if (profile.accountId) {
    headers['ChatGPT-Account-Id'] = profile.accountId;
  }

  const response = await fetchImpl('https://chatgpt.com/backend-api/wham/usage', {
    method: 'GET',
    headers
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  return createCodexUsageSnapshot({
    profile,
    capturedAt,
    responseStatus: response.status,
    ok: response.ok,
    data,
    rawText: text
  });
}

function createCodexUsageSnapshot({ profile, capturedAt, responseStatus, ok, data, rawText }) {
  const capturedAtIso = toIsoString(capturedAt);
  const lastSuccessAt = ok ? capturedAtIso : null;
  const lastFailureAt = ok ? null : capturedAtIso;

  return {
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `codex:${profile.id}:${capturedAtIso}`,
    capturedAt: capturedAtIso,
    provider: {
      id: 'openai-codex',
      displayName: 'Codex',
      region: null
    },
    account: {
      profileId: profile.id,
      accountId: profile.accountId ?? null,
      email: profile.email ?? null,
      plan: data?.plan_type ?? null
    },
    source: 'provider_usage_endpoint',
    authType: 'oauth',
    confidence: ok ? 'high' : 'medium',
    status: {
      bucket: resolveStatusBucket(responseStatus, ok),
      ok,
      httpStatus: responseStatus,
      message: ok ? null : safeErrorMessage(rawText),
      lastSuccessAt,
      lastFailureAt
    },
    usageWindows: [
      normalizeWindow('primary', data?.rate_limit?.primary_window),
      normalizeWindow('secondary', data?.rate_limit?.secondary_window)
    ].filter(Boolean),
    credits: {
      balance: data?.credits?.balance ?? null,
      unit: null
    },
    raw: {
      provider: 'openai-codex',
      rate_limit: data?.rate_limit ?? null,
      credits: data?.credits ?? null,
      plan_type: data?.plan_type ?? null,
      rawError: ok ? null : rawText.slice(0, 500)
    }
  };
}

function normalizeWindow(kind, window) {
  if (!window) return null;

  return {
    kind,
    label: `${kind} window`,
    usedPercent: window.used_percent ?? null,
    usedAmount: null,
    limitAmount: null,
    remainingAmount: null,
    windowSeconds: window.limit_window_seconds ?? null,
    resetAt: toIsoFromEpochSeconds(window.reset_at)
  };
}

function resolveStatusBucket(status, ok) {
  if (ok) return 'ok';
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 402) return 'billing';
  if (status >= 500) return 'overloaded';
  return 'unknown';
}

function toIsoFromEpochSeconds(value) {
  if (typeof value !== 'number') return null;
  return new Date(value * 1000).toISOString();
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function safeErrorMessage(rawText) {
  return rawText ? rawText.slice(0, 500) : 'unknown error';
}
