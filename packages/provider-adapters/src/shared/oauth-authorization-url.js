/**
 * OAuth authorize URL 조립 공통 헬퍼.
 *
 * Provider가 params 객체를 원하는 key 순서로 구성해 전달하면,
 * URL(...searchParams)로 합성한다.
 *
 * 모든 값은 string으로 강제 변환한다 (`URLSearchParams.set` 시맨틱).
 *
 * @param {object} options
 * @param {string} options.endpoint
 * @param {Record<string, string>} options.params
 * @returns {string}
 */
export function buildOAuthAuthorizationUrl({ endpoint, params }) {
  if (!endpoint) throw new Error('buildOAuthAuthorizationUrl: endpoint required');
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}
