import { fetchWithTimeout } from '../shared/fetch-with-timeout.js';
import {
  buildUsageSnapshot,
  toIsoString,
  parseJsonSafely,
} from '../shared/usage-snapshot.js';

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const PROVIDER_ID = 'anthropic-claude';

/**
 * Claude OAuth usage endpoint fetcher.
 *
 * GET https://api.anthropic.com/api/oauth/usage
 *   Authorization: Bearer <accessToken>
 *   anthropic-version: 2023-06-01
 *   anthropic-beta: oauth-2025-04-20
 *
 * 응답 shape (관찰값):
 *   five_hour: { utilization, resets_at }
 *   seven_day: { utilization, resets_at }
 *   seven_day_sonnet: { utilization }
 *   seven_day_opus:   { utilization }
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

  const response = await fetchWithTimeout(fetchImpl, USAGE_URL, {
    method: 'GET',
    headers,
    timeoutMs,
  });

  const text = await response.text();
  const data = parseJsonSafely(text);
  const ok = response.ok;

  return buildUsageSnapshot({
    profile,
    providerId: PROVIDER_ID,
    displayName: 'Claude',
    snapshotIdPrefix: 'claude',
    capturedAt,
    responseStatus: response.status,
    ok,
    data,
    rawText: text,
    fields: {
      plan: data?.plan ?? null,
      usageWindows: ok ? buildClaudeWindows(data) : [],
      raw: {
        five_hour: data?.five_hour ?? null,
        seven_day: data?.seven_day ?? null,
        seven_day_sonnet: data?.seven_day_sonnet ?? null,
        seven_day_opus: data?.seven_day_opus ?? null,
      },
      extraBucket: claudeStatusBucket,
    },
  });
}

function buildClaudeWindows(data) {
  return [
    normalizeWindow('five_hour', '5h', data?.five_hour),
    normalizeWindow('seven_day', 'Week', data?.seven_day),
    normalizeModelWindow('seven_day_sonnet', 'Sonnet', data?.seven_day_sonnet),
    normalizeModelWindow('seven_day_opus', 'Opus', data?.seven_day_opus),
  ].filter(Boolean);
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

/**
 * Claude 전용 status bucket 분기. `extraBucket`으로 buildUsageSnapshot에 주입된다.
 * 표준 분기에서 처리할 수 없는 케이스만 여기서 반환하고, null이면 표준 분기로 위임.
 */
function claudeStatusBucket(status, data) {
  if (status === 403) {
    const message = data?.error?.message;
    if (typeof message === 'string' && message.includes('scope requirement')) {
      return 'auth_scope';
    }
  }
  return null;
}
