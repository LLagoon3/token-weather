import { SCHEMA_VERSION } from '../../../schemas/src/index.js';
import { fetchWithTimeout } from '../shared/fetch-with-timeout.js';

/**
 * Claude OAuth usage endpoint fetcher.
 *
 * 확인된 endpoint / header 세트:
 *   GET https://api.anthropic.com/api/oauth/usage
 *   Authorization: Bearer <accessToken>
 *   anthropic-version: 2023-06-01
 *   anthropic-beta: oauth-2025-04-20
 *
 * 응답 shape (관찰값):
 *   {
 *     five_hour: { utilization: number, resets_at: ISO string },
 *     seven_day: { utilization: number, resets_at: ISO string },
 *     seven_day_sonnet: { utilization: number },
 *     seven_day_opus: { utilization: number }
 *   }
 *
 * @param {{ id: string, accessToken: string, accountId?: string|null, email?: string|null }} profile
 * @param {{ fetchImpl?: typeof fetch, capturedAt?: Date, timeoutMs?: number }} [options]
 */
export async function fetchClaudeUsage(profile, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const capturedAt = options.capturedAt ?? new Date();
  const timeoutMs = options.timeoutMs ?? 15_000;

  const headers = {
    Authorization: `Bearer ${profile.accessToken}`,
    Accept: 'application/json',
    'User-Agent': 'ai-usage-agent',
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'oauth-2025-04-20',
  };

  const response = await fetchWithTimeout(fetchImpl, 'https://api.anthropic.com/api/oauth/usage', {
    method: 'GET',
    headers,
    timeoutMs,
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  return createClaudeUsageSnapshot({
    profile,
    capturedAt,
    responseStatus: response.status,
    ok: response.ok,
    data,
    rawText: text,
  });
}

function createClaudeUsageSnapshot({ profile, capturedAt, responseStatus, ok, data, rawText }) {
  const capturedAtIso = toIsoString(capturedAt);
  const lastSuccessAt = ok ? capturedAtIso : null;
  const lastFailureAt = ok ? null : capturedAtIso;

  return {
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `claude:${profile.id}:${capturedAtIso}`,
    capturedAt: capturedAtIso,
    provider: {
      id: 'anthropic-claude',
      displayName: 'Claude',
      region: null,
    },
    account: {
      profileId: profile.id,
      accountId: profile.accountId ?? null,
      email: profile.email ?? null,
      plan: data?.plan ?? null,
    },
    source: 'provider_usage_endpoint',
    authType: 'oauth',
    confidence: ok ? 'high' : 'medium',
    status: {
      bucket: resolveStatusBucket(responseStatus, ok, data),
      ok,
      httpStatus: responseStatus,
      message: ok ? null : safeErrorMessage(data, rawText),
      lastSuccessAt,
      lastFailureAt,
    },
    usageWindows: ok
      ? [
          normalizeWindow('five_hour', '5h', data?.five_hour),
          normalizeWindow('seven_day', 'Week', data?.seven_day),
          normalizeModelWindow('seven_day_sonnet', 'Sonnet', data?.seven_day_sonnet),
          normalizeModelWindow('seven_day_opus', 'Opus', data?.seven_day_opus),
        ].filter(Boolean)
      : [],
    credits: {
      balance: null,
      unit: null,
    },
    raw: {
      provider: 'anthropic-claude',
      five_hour: data?.five_hour ?? null,
      seven_day: data?.seven_day ?? null,
      seven_day_sonnet: data?.seven_day_sonnet ?? null,
      seven_day_opus: data?.seven_day_opus ?? null,
      rawError: ok ? null : (rawText ?? '').slice(0, 500),
    },
  };
}

function normalizeWindow(kind, label, window) {
  if (!window || typeof window.utilization !== 'number') return null;
  return {
    kind,
    label: `${label} window`,
    usedPercent: clampPercent(window.utilization),
    usedAmount: null,
    limitAmount: null,
    remainingAmount: null,
    windowSeconds: null,
    resetAt: window.resets_at ? toIsoString(window.resets_at) : null,
  };
}

function normalizeModelWindow(kind, label, window) {
  if (!window || typeof window.utilization !== 'number') return null;
  return {
    kind,
    label: `${label} weekly`,
    usedPercent: clampPercent(window.utilization),
    usedAmount: null,
    limitAmount: null,
    remainingAmount: null,
    windowSeconds: null,
    resetAt: null,
  };
}

function clampPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const scaled = value <= 1 ? value * 100 : value;
  if (scaled < 0) return 0;
  if (scaled > 100) return 100;
  return scaled;
}

function resolveStatusBucket(status, ok, data) {
  if (ok) return 'ok';
  if (status === 401) return 'auth';
  if (status === 403) {
    const message = data?.error?.message;
    if (typeof message === 'string' && message.includes('scope requirement')) {
      return 'auth_scope';
    }
    return 'auth';
  }
  if (status === 429) return 'rate_limit';
  if (status === 402) return 'billing';
  if (status >= 500) return 'overloaded';
  return 'unknown';
}

function safeErrorMessage(data, rawText) {
  const apiMessage = data?.error?.message;
  if (typeof apiMessage === 'string' && apiMessage.trim()) {
    return apiMessage.trim();
  }
  return rawText ? rawText.slice(0, 500) : 'unknown error';
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
