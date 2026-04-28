import { fetchWithTimeout } from './fetch-with-timeout.js';

/**
 * OAuth token endpoint POST 공통 헬퍼 (authorization_code / refresh_token 공용).
 *
 * Provider별 차이점은 인자로 흡수:
 *   - endpoint URL
 *   - body encoding: 'form' (기본) 또는 'json' (Claude 등 요구)
 *   - extra headers (e.g. anthropic-version)
 *   - errorPrefix (메시지 접두)
 *
 * 응답은 표준 OAuth shape으로 정규화:
 *   { accessToken, refreshToken, idToken, expiresIn, tokenType, scope }
 *
 * `fallbackRefreshToken`을 넘기면 응답에 refresh_token이 없을 때 기존 값을 유지한다
 * (grant_type=refresh_token 시 rotation 없이 기존 토큰 유지하는 정책).
 */

/**
 * @param {object} options
 * @param {string} options.endpoint
 * @param {Record<string, any>} options.body
 * @param {'form'|'json'} [options.encoding='form']
 * @param {Record<string, string>} [options.extraHeaders]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {string} [options.errorPrefix='OAuth token request failed']
 * @param {string} [options.fallbackRefreshToken] - 응답에 refresh_token 없을 때 대체
 * @param {number} [options.timeoutMs=15000] - AbortController 기반 요청 타임아웃 (0이면 비활성)
 * @returns {Promise<{ accessToken: string, refreshToken: string|null, idToken: string|null, expiresIn: number, tokenType: string, scope: string|null }>}
 */
export async function postToTokenEndpoint({
  endpoint,
  body,
  encoding = 'form',
  extraHeaders,
  fetchImpl = fetch,
  errorPrefix = 'OAuth token request failed',
  fallbackRefreshToken,
  timeoutMs = 15_000,
}) {
  if (!endpoint) throw new Error('postToTokenEndpoint: endpoint required');
  if (!body || typeof body !== 'object') {
    throw new Error('postToTokenEndpoint: body must be an object');
  }

  const { headers, encodedBody } = encodeRequest(body, encoding, extraHeaders);

  const res = await fetchWithTimeout(fetchImpl, endpoint, {
    method: 'POST',
    headers,
    body: encodedBody,
    timeoutMs,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${errorPrefix}: ${res.status} ${res.statusText} — ${text}`);
  }

  const json = await res.json();

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? fallbackRefreshToken ?? null,
    idToken: json.id_token ?? null,
    expiresIn: json.expires_in,
    tokenType: json.token_type,
    scope: json.scope ?? null,
  };
}

function encodeRequest(body, encoding, extraHeaders) {
  if (encoding === 'json') {
    return {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...extraHeaders,
      },
      encodedBody: JSON.stringify(body),
    };
  }

  if (encoding === 'form') {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined || v === null) continue;
      form.set(k, String(v));
    }
    return {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...extraHeaders,
      },
      encodedBody: form.toString(),
    };
  }

  throw new Error(`postToTokenEndpoint: unknown encoding "${encoding}"`);
}
