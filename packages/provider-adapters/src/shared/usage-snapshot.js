import { SCHEMA_VERSION } from '../../../schemas/src/index.js';

/**
 * Provider-중립 usage snapshot 헬퍼.
 *
 * 각 provider의 fetch-*-usage는 응답 파싱(provider별 응답 shape) 정도만 담당하고,
 * snapshot 골격(status bucket / confidence / 표준 필드)은 이 모듈에서 만든다.
 */

/**
 * @param {number|undefined} status
 * @param {boolean} ok
 * @param {(status: number, data: any) => string|null} [extraBucket]
 *   ok가 false일 때 표준 분기 전에 호출. null이면 표준 분기 사용.
 * @param {any} [data]
 * @returns {'ok'|'auth'|'auth_scope'|'rate_limit'|'billing'|'overloaded'|'unknown'|string}
 */
export function resolveStatusBucket(status, ok, extraBucket, data) {
  if (ok) return 'ok';
  if (extraBucket) {
    const custom = extraBucket(status, data);
    if (custom) return custom;
  }
  if (status === 401) return 'auth';
  if (status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 402) return 'billing';
  if (typeof status === 'number' && status >= 500) return 'overloaded';
  return 'unknown';
}

/**
 * Parsed-JSON 응답에서 표준화된 에러 메시지 추출.
 * 우선순위: `data.error.message` → `data.message` → rawText slice → 'unknown error'.
 *
 * @param {any} data
 * @param {string} [rawText]
 * @returns {string}
 */
export function safeErrorMessage(data, rawText = '') {
  const apiMessage = data?.error?.message ?? data?.message;
  if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage.trim();
  return rawText ? rawText.slice(0, 500) : 'unknown error';
}

/**
 * Date | string | number → ISO string. number는 ms epoch로 간주.
 */
export function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Epoch seconds(number) → ISO string. number가 아니면 null.
 */
export function toIsoFromEpochSeconds(value) {
  if (typeof value !== 'number') return null;
  return new Date(value * 1000).toISOString();
}

/**
 * 응답 텍스트를 안전하게 JSON.parse. 실패 시 null.
 */
export function parseJsonSafely(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 표준 usage snapshot 골격 생성. provider-specific 가변 필드는 spec에서 받는다.
 *
 * @param {object} args
 * @param {{ id: string, accountId?: string|null, email?: string|null }} args.profile
 * @param {string} args.providerId        - 'openai-codex' | 'anthropic-claude' 등
 * @param {string} args.displayName       - 'Codex' | 'Claude'
 * @param {string} args.snapshotIdPrefix  - snapshotId 접두 (보통 providerId의 짧은 별칭 — 'codex' / 'claude')
 * @param {Date|string|number} args.capturedAt
 * @param {number} args.responseStatus
 * @param {boolean} args.ok
 * @param {any} args.data
 * @param {string} args.rawText
 * @param {object} [args.fields] - account.plan / usageWindows / credits / raw 등 provider-specific
 * @param {string|null} [args.fields.plan]
 * @param {Array<object>} [args.fields.usageWindows]
 * @param {{ balance: number|null, unit: string|null }} [args.fields.credits]
 * @param {object} [args.fields.raw]                      - raw 영역에 추가될 provider 응답 키들
 * @param {(status: number, data: any) => string|null} [args.fields.extraBucket]
 * @returns {object}
 */
export function buildUsageSnapshot({
  profile,
  providerId,
  displayName,
  snapshotIdPrefix,
  capturedAt,
  responseStatus,
  ok,
  data,
  rawText,
  fields = {},
}) {
  const capturedAtIso = toIsoString(capturedAt);
  const lastSuccessAt = ok ? capturedAtIso : null;
  const lastFailureAt = ok ? null : capturedAtIso;

  return {
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `${snapshotIdPrefix}:${profile.id}:${capturedAtIso}`,
    capturedAt: capturedAtIso,
    provider: { id: providerId, displayName, region: null },
    account: {
      profileId: profile.id,
      accountId: profile.accountId ?? null,
      email: profile.email ?? null,
      plan: fields.plan ?? null,
    },
    source: 'provider_usage_endpoint',
    authType: 'oauth',
    confidence: ok ? 'high' : 'medium',
    status: {
      bucket: resolveStatusBucket(responseStatus, ok, fields.extraBucket, data),
      ok,
      httpStatus: responseStatus,
      message: ok ? null : safeErrorMessage(data, rawText),
      lastSuccessAt,
      lastFailureAt,
    },
    usageWindows: ok ? (fields.usageWindows ?? []) : [],
    credits: fields.credits ?? { balance: null, unit: null },
    raw: {
      provider: providerId,
      ...(fields.raw ?? {}),
      rawError: ok ? null : (rawText ?? '').slice(0, 500),
    },
  };
}
