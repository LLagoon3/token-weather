/**
 * Codex (OpenAI) OAuth authorization_code 교환.
 *
 * refresh_token 흐름은 `./refresh-codex-token.js` (v0.3.0 분리, Claude 의
 * refresh-claude-token.js 와 대칭). 공통 transport 로직은
 * `../shared/oauth-token-endpoint.js`.
 *
 * 미해결:
 *   - client_secret 필요 여부 (현재는 public client 가정)
 */

import { CODEX_AUTH } from './codex-auth-constants.js';
import { postToTokenEndpoint } from '../shared/oauth-token-endpoint.js';

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
  clientId = CODEX_AUTH.observedClientId,
  clientSecret,
  tokenEndpoint = CODEX_AUTH.tokenEndpoint,
  fetchImpl,
}) {
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
