/**
 * Codex (OpenAI) OAuth token 교환 (authorization_code / refresh_token).
 *
 * 두 함수 모두 `allowLiveExchange` guard를 가진다. 기본값은 false이며
 * 명시적으로 true를 전달할 때만 network POST가 수행된다.
 *
 * 공통 transport 로직은 `../shared/oauth-token-endpoint.js`에 있다.
 *
 * 미해결:
 *   - client_secret 필요 여부 (현재는 public client 가정)
 *   - refresh token rotation 정책
 */

import { CODEX_AUTH } from './codex-auth-constants.js';
import { postToTokenEndpoint, liveExchangeDisabledError } from '../shared/oauth-token-endpoint.js';

const CLIENT_ID_NOTE = 'Note: client_id is an observed value and not officially confirmed.';

/**
 * @typedef {object} TokenResponse
 * @property {string}        accessToken
 * @property {string|null}   refreshToken
 * @property {string|null}   idToken
 * @property {number}        expiresIn
 * @property {string}        tokenType
 * @property {string|null}   scope
 */

/**
 * Exchange an authorization code for tokens at the Codex token endpoint.
 *
 * @param {{
 *   code: string,
 *   callbackUrl: string,
 *   codeVerifier: string,
 *   allowLiveExchange?: boolean,
 *   clientId?: string,
 *   clientSecret?: string,
 *   tokenEndpoint?: string,
 *   fetchImpl?: typeof fetch,
 * }} params
 * @returns {Promise<TokenResponse>}
 */
export async function exchangeCodexAuthorizationCode({
  code,
  callbackUrl,
  codeVerifier,
  allowLiveExchange = false,
  clientId = CODEX_AUTH.observedClientId,
  clientSecret,
  tokenEndpoint = CODEX_AUTH.tokenEndpoint,
  fetchImpl,
}) {
  if (!allowLiveExchange) {
    throw liveExchangeDisabledError({
      caller: 'exchangeCodexAuthorizationCode',
      endpoint: tokenEndpoint,
      grantType: 'authorization_code',
      clientIdNote: CLIENT_ID_NOTE,
    });
  }

  return postToTokenEndpoint({
    endpoint: tokenEndpoint,
    encoding: 'form',
    body: {
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      client_id: clientId,
      code_verifier: codeVerifier,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    },
    errorPrefix: 'Token exchange failed',
    fetchImpl,
  });
}

/**
 * Refresh an access token using a refresh token.
 *
 * @param {{
 *   refreshToken: string,
 *   allowLiveExchange?: boolean,
 *   clientId?: string,
 *   clientSecret?: string,
 *   tokenEndpoint?: string,
 *   fetchImpl?: typeof fetch,
 * }} params
 * @returns {Promise<TokenResponse>}
 */
export async function refreshCodexToken({
  refreshToken,
  allowLiveExchange = false,
  clientId = CODEX_AUTH.observedClientId,
  clientSecret,
  tokenEndpoint = CODEX_AUTH.tokenEndpoint,
  fetchImpl,
}) {
  if (!allowLiveExchange) {
    throw liveExchangeDisabledError({
      caller: 'refreshCodexToken',
      endpoint: tokenEndpoint,
      grantType: 'refresh_token',
      clientIdNote: CLIENT_ID_NOTE,
    });
  }

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
