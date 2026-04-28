import { CLAUDE_AUTH } from './claude-auth-constants.js';
import { postToTokenEndpoint } from '../shared/oauth-token-endpoint.js';

/**
 * Claude OAuth refresh token 교환.
 *
 * Codex refreshCodexToken과 동일한 shape.
 * Claude는 JSON body 필요 (token endpoint 공통).
 *
 * 응답에 `refresh_token`이 오면 rotation, 아니면 입력 refreshToken을 그대로 유지.
 *
 * @param {{
 *   refreshToken: string,
 *   clientId?: string,
 *   clientSecret?: string,
 *   tokenEndpoint?: string,
 *   fetchImpl?: typeof fetch,
 * }} params
 */
export async function refreshClaudeToken({
  refreshToken,
  clientId = CLAUDE_AUTH.observedClientId,
  clientSecret,
  tokenEndpoint = CLAUDE_AUTH.tokenEndpoint,
  fetchImpl,
}) {
  if (!refreshToken) {
    throw new Error('[refreshClaudeToken] refreshToken이 비어 있습니다.');
  }

  return postToTokenEndpoint({
    endpoint: tokenEndpoint,
    encoding: 'json',
    body: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    },
    errorPrefix: 'Claude token refresh failed',
    fallbackRefreshToken: refreshToken,
    fetchImpl,
  });
}
