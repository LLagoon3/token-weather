import { CODEX_AUTH } from './codex-auth-constants.js';
import { postToTokenEndpoint } from '../shared/oauth-token-endpoint.js';

/**
 * Codex (OpenAI) OAuth refresh token 교환.
 *
 * Claude refreshClaudeToken과 동일한 shape — 단 Codex 는 form-encoded body
 * 를 요구해 `encoding: 'form'` 을 사용한다 (Claude 는 'json'). 응답에
 * `refresh_token` 이 오면 rotation, 아니면 입력 refreshToken 을 그대로 유지
 * (`fallbackRefreshToken`).
 *
 * 본 함수는 v0.3.0 에서 `exchange-codex-authorization-code.js` 로부터 분리
 * (issue #105 / refactor: provider-adapters symmetry). 두 provider 의
 * `refresh-*-token.js` 단독 파일 구조로 정렬되어 미래 provider 추가 시
 * 패턴을 따라가기 쉬워진다.
 *
 * @param {{
 *   refreshToken: string,
 *   clientId?: string,
 *   clientSecret?: string,
 *   tokenEndpoint?: string,
 *   fetchImpl?: typeof fetch,
 * }} params
 * @returns {Promise<import('./exchange-codex-authorization-code.js').TokenResponse>}
 */
export async function refreshCodexToken({
  refreshToken,
  clientId = CODEX_AUTH.observedClientId,
  clientSecret,
  tokenEndpoint = CODEX_AUTH.tokenEndpoint,
  fetchImpl,
}) {
  return postToTokenEndpoint({
    endpoint: tokenEndpoint,
    encoding: 'form',
    body: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    },
    errorPrefix: 'Token refresh failed',
    fallbackRefreshToken: refreshToken,
    fetchImpl,
  });
}
