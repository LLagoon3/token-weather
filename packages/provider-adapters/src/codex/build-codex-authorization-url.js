import { CODEX_AUTH } from './codex-auth-constants.js';
import { buildOAuthAuthorizationUrl } from '../shared/oauth-authorization-url.js';

/**
 * Build the Codex (OpenAI) OAuth authorization URL.
 *
 * 브라우저에서 열 URL만 조립한다 — HTTP 호출 없음.
 *
 * client_id는 로컬 Codex CLI JWT payload에서 관찰한 값이 기본이며, 공식 확정된
 * 값이 아니라는 점에 유의.
 *
 * @param {object} params
 * @param {string} params.callbackUrl
 * @param {string} params.state
 * @param {string} params.codeChallenge
 * @param {string} params.codeChallengeMethod  - 'S256' 권장
 * @param {string} [params.clientId]           - 기본: CODEX_AUTH.observedClientId
 * @param {string[]} [params.scopes]           - 기본: CODEX_AUTH.defaultScopes
 * @returns {string}
 */
export function buildCodexAuthorizationUrl({
  callbackUrl,
  state,
  codeChallenge,
  codeChallengeMethod,
  clientId = CODEX_AUTH.observedClientId,
  scopes = CODEX_AUTH.defaultScopes,
}) {
  return buildOAuthAuthorizationUrl({
    endpoint: CODEX_AUTH.authorizationEndpoint,
    params: {
      response_type: CODEX_AUTH.responseType,
      client_id: clientId,
      redirect_uri: callbackUrl,
      state,
      scope: scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      // OpenClaw observed extras (OAuth spec 외)
      ...(CODEX_AUTH.extraAuthorizeParams ?? {}),
    },
  });
}
