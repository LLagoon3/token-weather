/**
 * status / usage --json 출력 모듈.
 *
 * 두 가지 책임:
 * 1) `redactSensitive(value)` — 객체를 재귀적으로 walk하면서 토큰/세션 계열
 *    민감 키를 제거한 사본을 반환한다. 원본은 변경하지 않는다.
 * 2) `formatStatusJson(snapshot, { command, generatedAt })` — status snapshot을
 *    {command, generatedAt, providerFilter, accountFilter, providers[]} shape의
 *    JSON 문자열 한 줄로 직렬화한다.
 *
 * stdout은 자동화/대시보드가 파싱 가능한 단일 line이어야 하므로 indent하지 않는다.
 * 추가 안내·헤더는 모두 stderr 또는 비-json 모드에서만 출력해야 한다.
 */

import { PROVIDER_IDS } from '../services/provider-registry.js';

/**
 * JSON 출력에서 제거할 민감 키 목록.
 * 신규 토큰 필드가 추가되면 여기에 등록한다.
 */
export const SENSITIVE_KEYS = Object.freeze(
  new Set([
    'accessToken',
    'refreshToken',
    'idToken',
    'tokens',
    'sessionKey',
    'sessionCookie',
    'codeVerifier',
    'client_secret',
  ]),
);

/**
 * 객체를 재귀 순회하며 SENSITIVE_KEYS 항목을 빼고 deep clone을 반환한다.
 * Date 인스턴스는 직렬화 시 toJSON으로 처리되므로 그대로 통과시킨다.
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function redactSensitive(value) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(redactSensitive);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(k)) continue;
    out[k] = redactSensitive(v);
  }
  return out;
}

/**
 * status snapshot을 JSON 출력용 문자열로 직렬화한다.
 *
 * 출력 shape:
 * ```
 * {
 *   "command": "status" | "usage",
 *   "generatedAt": "<ISO-8601>",
 *   "schemaVersion": <int>,
 *   "configPath": <string>,
 *   "accountFilter": <string|null>,
 *   "providerFilter": <string|null>,
 *   "providers": [
 *     { "id": "codex" | "claude", "snapshot": { ... } },
 *     ...
 *   ]
 * }
 * ```
 *
 * provider id는 `--provider <id>`가 받는 registry id(`codex`/`claude`)와 동일.
 * 출력 line 끝에 newline은 붙이지 않는다 (호출자가 결정).
 *
 * @param {object} snapshot - getStatusSnapshot 결과
 * @param {{ command?: string, generatedAt?: string|Date }} [meta]
 * @returns {string}
 */
export function formatStatusJson(snapshot, meta = {}) {
  const command = meta.command ?? 'status';
  const generatedAt = formatGeneratedAt(meta.generatedAt);

  const providers = [];
  for (const id of PROVIDER_IDS) {
    if (id in snapshot && snapshot[id] !== undefined) {
      providers.push({ id, snapshot: redactSensitive(snapshot[id]) });
    }
  }

  const out = {
    command,
    generatedAt,
    schemaVersion: snapshot.schemaVersion ?? null,
    configPath: snapshot.configPath ?? null,
    accountFilter: snapshot.accountFilter ?? null,
    providerFilter: snapshot.providerFilter ?? null,
    providers,
  };

  return JSON.stringify(out);
}

function formatGeneratedAt(input) {
  if (input instanceof Date) return input.toISOString();
  if (typeof input === 'string' && input.length > 0) return input;
  return new Date().toISOString();
}
