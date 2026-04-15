import { CLAUDE_AUTH } from './claude-auth-constants.js';
import { buildOAuthAuthorizationUrl } from '../shared/oauth-authorization-url.js';

/**
 * Build the Claude (Anthropic) OAuth authorization URL.
 *
 * HTTP 호출 없이 브라우저에서 열 URL만 조립한다.
 *
 * 관찰된 사항:
 *   - OAuth 스펙 외 파라미터 `code=true`가 앞에 필요 (Claude authorize 서버 요구)
 *   - claude.ai 사용자 OAuth 경로 (CLAUDE_AUTH.authorizationEndpoint)
 *   - client_id는 Claude Code 바이너리 관찰값 (공식 확정 아님)
 *
 * @param {object} params
 * @param {string} params.callbackUrl
 * @param {string} params.state
 * @param {string} params.codeChallenge
 * @param {string} params.codeChallengeMethod
 * @param {string} [params.clientId]
 * @param {string[]} [params.scopes]
 * @returns {string}
 */
export function buildClaudeAuthorizationUrl({
  callbackUrl,
  state,
  codeChallenge,
  codeChallengeMethod,
  clientId = CLAUDE_AUTH.observedClientId,
  scopes = CLAUDE_AUTH.defaultScopes,
}) {
  return buildOAuthAuthorizationUrl({
    endpoint: CLAUDE_AUTH.authorizationEndpoint,
    params: {
      // Claude Code가 실제로 붙이는 관찰 파라미터 순서를 그대로 재현한다.
      // `code=true`는 OAuth 스펙 외 확장이지만 서버가 기대한다.
      code: 'true',
      client_id: clientId,
      response_type: CLAUDE_AUTH.responseType,
      redirect_uri: callbackUrl,
      scope: scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      state,
    },
  });
}
