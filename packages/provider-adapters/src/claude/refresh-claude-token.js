import { CLAUDE_AUTH } from './claude-auth-constants.js';

/**
 * Claude OAuth refresh token exchange — guarded real fetch.
 *
 * Codex 쪽 `refreshCodexToken`과 동일한 guard/shape를 따른다.
 * `allowLiveExchange: true` 없이 호출하면 설명적 에러를 던진다.
 *
 * ## 미해결
 *   - client_secret 요구 여부 (현재는 public client로 가정)
 *   - refresh token rotation 정책 (응답에 새 refresh_token이 오면 교체)
 *
 * @param {{
 *   refreshToken: string,
 *   allowLiveExchange?: boolean,
 *   clientId?: string,
 *   clientSecret?: string,
 *   tokenEndpoint?: string,
 *   fetchImpl?: typeof fetch,
 * }} params
 * @returns {Promise<{ accessToken: string, refreshToken: string|null, idToken: string|null, expiresIn: number, tokenType: string, scope: string|null }>}
 */
export async function refreshClaudeToken({
  refreshToken,
  allowLiveExchange = false,
  clientId = CLAUDE_AUTH.observedClientId,
  clientSecret = undefined,
  tokenEndpoint = CLAUDE_AUTH.tokenEndpoint,
  fetchImpl = fetch,
}) {
  if (!refreshToken) {
    throw new Error('[refreshClaudeToken] refreshToken이 비어 있습니다.');
  }

  const body = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  };

  if (clientSecret) {
    body.client_secret = clientSecret;
  }

  if (!allowLiveExchange) {
    throw new Error(
      '[refreshClaudeToken] Live exchange is disabled. ' +
        'Pass { allowLiveExchange: true } to perform a real POST to ' +
        `${tokenEndpoint} (grant_type=refresh_token). ` +
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
      `Claude token refresh failed: ${res.status} ${res.statusText} — ${text}`,
    );
  }

  const json = await res.json();

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken, // rotation 시 교체, 아니면 기존 유지
    idToken: json.id_token ?? null,
    expiresIn: json.expires_in,
    tokenType: json.token_type,
    scope: json.scope ?? null,
  };
}
