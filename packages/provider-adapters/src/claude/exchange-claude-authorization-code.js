import { CLAUDE_AUTH } from './claude-auth-constants.js';

/**
 * Claude OAuth authorization code → token 교환.
 *
 * Codex의 exchangeCodexAuthorizationCode와 동일한 guard 패턴.
 * `allowLiveExchange: true` 없이 호출하면 설명적 에러를 던진다.
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
 * @returns {Promise<{ accessToken: string, refreshToken: string|null, idToken: string|null, expiresIn: number, tokenType: string, scope: string|null }>}
 */
export async function exchangeClaudeAuthorizationCode({
  code,
  callbackUrl,
  codeVerifier,
  state,
  allowLiveExchange = false,
  clientId = CLAUDE_AUTH.observedClientId,
  clientSecret = undefined,
  tokenEndpoint = CLAUDE_AUTH.tokenEndpoint,
  fetchImpl = fetch,
}) {
  if (!code) throw new Error('[exchangeClaudeAuthorizationCode] code가 비어 있습니다.');
  if (!callbackUrl) throw new Error('[exchangeClaudeAuthorizationCode] callbackUrl이 비어 있습니다.');
  if (!codeVerifier) throw new Error('[exchangeClaudeAuthorizationCode] codeVerifier가 비어 있습니다.');

  // Claude token endpoint는 state 필드를 body에 요구한다 (OAuth 스펙 외 확장).
  // 바이너리 관찰: grant_type / code / redirect_uri / client_id / code_verifier / state.
  const body = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
    client_id: clientId,
    code_verifier: codeVerifier,
  };
  if (state) body.state = state;

  if (clientSecret) body.client_secret = clientSecret;

  if (!allowLiveExchange) {
    throw new Error(
      '[exchangeClaudeAuthorizationCode] Live exchange is disabled. ' +
        'Pass { allowLiveExchange: true } to perform a real POST to ' +
        `${tokenEndpoint} (grant_type=authorization_code). ` +
        'Note: client_id is an observed value from the Claude Code binary and not officially confirmed.',
    );
  }

  const res = await fetchImpl(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Claude token exchange failed: ${res.status} ${res.statusText} — ${text}`,
    );
  }

  const json = await res.json();

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    idToken: json.id_token ?? null,
    expiresIn: json.expires_in,
    tokenType: json.token_type,
    scope: json.scope ?? null,
  };
}
