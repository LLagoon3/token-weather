import { fetchWithTimeout } from '../shared/fetch-with-timeout.js';

/**
 * Claude OAuth profile endpoint (internal, unofficial).
 * Best-effort only: callers must tolerate 401/403/404/429/5xx and schema drift.
 */
const DEFAULT_ENDPOINT = 'https://api.anthropic.com/api/oauth/profile';

/**
 * @param {{
 *   accessToken: string,
 *   endpoint?: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 * }} params
 * @returns {Promise<{
 *   account: object|null,
 *   organization: object|null,
 *   application: object|null,
 *   email: string|null,
 *   displayName: string|null,
 *   accountId: string|null,
 *   raw: object,
 * }>}
 */
export async function fetchClaudeOauthProfile({
  accessToken,
  endpoint = DEFAULT_ENDPOINT,
  fetchImpl = fetch,
  timeoutMs = 15_000,
}) {
  if (!accessToken) {
    throw new Error('fetchClaudeOauthProfile: accessToken이 비어 있습니다.');
  }

  const res = await fetchWithTimeout(fetchImpl, endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'oauth-2025-04-20',
      'User-Agent': 'token-weather',
    },
    timeoutMs,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      payload?.error?.message ?? payload?.error_description ?? payload?.message ?? res.statusText;
    throw new Error(`Claude OAuth profile fetch failed: ${res.status} ${message}`);
  }

  const account = isRecord(payload?.account) ? payload.account : null;
  const organization = isRecord(payload?.organization) ? payload.organization : null;
  const application = isRecord(payload?.application) ? payload.application : null;

  return {
    account,
    organization,
    application,
    email: readString(account?.email),
    displayName: readString(account?.display_name) ?? readString(account?.full_name) ?? null,
    accountId: readString(account?.uuid),
    raw: isRecord(payload) ? payload : {},
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
