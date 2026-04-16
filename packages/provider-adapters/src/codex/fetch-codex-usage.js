import { fetchWithTimeout } from '../shared/fetch-with-timeout.js';
import {
  buildUsageSnapshot,
  toIsoFromEpochSeconds,
  parseJsonSafely,
} from '../shared/usage-snapshot.js';

const USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage';
const PROVIDER_ID = 'openai-codex';

export async function fetchCodexUsage(profile, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const capturedAt = options.capturedAt ?? new Date();
  const timeoutMs = options.timeoutMs ?? 15_000;

  const headers = {
    Authorization: `Bearer ${profile.accessToken}`,
    Accept: 'application/json',
    'User-Agent': 'CodexBar',
  };
  if (profile.accountId) headers['ChatGPT-Account-Id'] = profile.accountId;

  const response = await fetchWithTimeout(fetchImpl, USAGE_URL, {
    method: 'GET',
    headers,
    timeoutMs,
  });

  const text = await response.text();
  const data = parseJsonSafely(text);

  return buildUsageSnapshot({
    profile,
    providerId: PROVIDER_ID,
    displayName: 'Codex',
    snapshotIdPrefix: 'codex',
    capturedAt,
    responseStatus: response.status,
    ok: response.ok,
    data,
    rawText: text,
    fields: {
      plan: data?.plan_type ?? null,
      usageWindows: [
        normalizeWindow('primary', data?.rate_limit?.primary_window),
        normalizeWindow('secondary', data?.rate_limit?.secondary_window),
      ].filter(Boolean),
      credits: { balance: data?.credits?.balance ?? null, unit: null },
      raw: {
        rate_limit: data?.rate_limit ?? null,
        credits: data?.credits ?? null,
        plan_type: data?.plan_type ?? null,
      },
    },
  });
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
    resetAt: toIsoFromEpochSeconds(window.reset_at),
  };
}
