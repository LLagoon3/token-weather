import { CLAUDE_AUTH } from './claude-auth-constants.js';
import {
  postToTokenEndpoint,
  liveExchangeDisabledError,
} from '../shared/oauth-token-endpoint.js';

const CLIENT_ID_NOTE =
  'Note: client_id is an observed value from the Claude Code binary and not officially confirmed.';

/**
 * Claude OAuth authorization code → token 교환.
 *
 * Codex와 동일한 `allowLiveExchange` guard 패턴.
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
 *   allowLiveExchange?: boolean,
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
 *   `allowLiveExchange: false`(기본값) 시 `liveExchangeDisabledError` throw.
 */
export async function exchangeClaudeAuthorizationCode({
  code,
  callbackUrl,
  codeVerifier,
  state,
  allowLiveExchange = false,
  clientId = CLAUDE_AUTH.observedClientId,
  clientSecret,
  tokenEndpoint = CLAUDE_AUTH.tokenEndpoint,
  fetchImpl,
}) {
  if (!code) throw new Error('[exchangeClaudeAuthorizationCode] code가 비어 있습니다.');
  if (!callbackUrl) throw new Error('[exchangeClaudeAuthorizationCode] callbackUrl이 비어 있습니다.');
  if (!codeVerifier) throw new Error('[exchangeClaudeAuthorizationCode] codeVerifier가 비어 있습니다.');

  if (!allowLiveExchange) {
    throw liveExchangeDisabledError({
      caller: 'exchangeClaudeAuthorizationCode',
      endpoint: tokenEndpoint,
      grantType: 'authorization_code',
      clientIdNote: CLIENT_ID_NOTE,
    });
  }

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
