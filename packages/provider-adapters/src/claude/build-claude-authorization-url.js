import { CLAUDE_AUTH } from './claude-auth-constants.js';

/**
 * Build the Claude (Anthropic) OAuth authorization URL.
 *
 * HTTP 호출은 수행하지 않고, 브라우저에서 열 authorize URL만 조립한다.
 *
 * 주의:
 *   - `clientId`와 `scopes` 기본값은 Claude Code 바이너리에서 관찰된 값.
 *     Anthropic 공식 문서에 기재된 값이 아니므로 성공이 보장되지 않는다.
 *   - redirect_uri는 localhost callback(기본 `/callback`) 또는 Claude platform
 *     manual redirect를 모두 받는다.
 *
 * @param {object} params
 * @param {string} params.callbackUrl - The redirect_uri (localhost or manual).
 * @param {string} params.state - OAuth state parameter.
 * @param {string} params.codeChallenge - PKCE code_challenge value.
 * @param {string} params.codeChallengeMethod - PKCE method ('S256' default in caller).
 * @param {string} [params.clientId] - Override client_id.
 * @param {string[]} [params.scopes] - Override scopes.
 * @returns {string} Authorization URL with query parameters.
 */
export function buildClaudeAuthorizationUrl({
  callbackUrl,
  state,
  codeChallenge,
  codeChallengeMethod,
  clientId = CLAUDE_AUTH.observedClientId,
  scopes = CLAUDE_AUTH.defaultScopes,
}) {
  const url = new URL(CLAUDE_AUTH.authorizationEndpoint);
  url.searchParams.set('response_type', CLAUDE_AUTH.responseType);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', codeChallengeMethod);
  return url.toString();
}
