import { CLAUDE_AUTH } from './claude-auth-constants.js';
import { postToTokenEndpoint } from '../shared/oauth-token-endpoint.js';

/**
 * Claude OAuth authorization code → token 교환.
 *
 * Claude 관찰 특이사항:
 *   - token endpoint는 JSON body를 요구 (form은 Claude API 에러)
 *   - authorization_code grant는 body에 `state` 필드 포함 필요
 *
 * @param {{
 *   code: string,
 *   callbackUrl: string,
 *   codeVerifier: string,
 *   state?: string,
 *   clientId?: string,
 *   clientSecret?: string,
 *   tokenEndpoint?: string,
 *   fetchImpl?: typeof fetch,
 * }} params
 * @returns {Promise<{
 *   accessToken: string,
 *   refreshToken: string|null,
 *   idToken: string|null,
 *   expiresIn: number|null,
 *   tokenType: string|null,
 *   scope: string|null
 * }>} 정규화된 token 응답 shape (`shared/oauth-token-endpoint.js::postToTokenEndpoint`가 제공).
 */
export async function exchangeClaudeAuthorizationCode({
  code,
  callbackUrl,
  codeVerifier,
  state,
  clientId = CLAUDE_AUTH.observedClientId,
  clientSecret,
  tokenEndpoint = CLAUDE_AUTH.tokenEndpoint,
  fetchImpl,
}) {
  if (!code) throw new Error('[exchangeClaudeAuthorizationCode] code가 비어 있습니다.');
  if (!callbackUrl)
    throw new Error('[exchangeClaudeAuthorizationCode] callbackUrl이 비어 있습니다.');
  if (!codeVerifier)
    throw new Error('[exchangeClaudeAuthorizationCode] codeVerifier가 비어 있습니다.');

  return postToTokenEndpoint({
    endpoint: tokenEndpoint,
    encoding: 'json',
    body: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      client_id: clientId,
      code_verifier: codeVerifier,
      ...(state ? { state } : {}),
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    },
    errorPrefix: 'Claude token exchange failed',
    fetchImpl,
  });
}
