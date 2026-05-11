/**
 * `~/.codex/auth.json` 의 tokens 객체를 token-weather 내부 정규화 shape 으로
 * 변환한다. claude 측의 `mapClaudeCredentials` 와 대칭 (provider CLI credential
 * 정규화 helper).
 *
 * 입력 schema (Codex CLI):
 *   { id_token, access_token, refresh_token, account_id }
 *
 * 출력 shape:
 *   {
 *     provider: 'codex',
 *     accessToken,
 *     refreshToken,
 *     idToken,           // raw JWT — identity 추출은 downstream 에서 (token-claims 등)
 *     accountId,         // tokens.account_id (raw)
 *   }
 *
 * 본 helper 는 정규화만 수행 — JWT 디코드 / sub / email 추출은 downstream
 * resolver (예: extract-account-identity-from-store) 에서 한다. claude 측의
 * mapClaudeCredentials 도 동일 정책 (디코드 안 함, 토큰만 통과).
 *
 * @param {object|null} tokens
 * @returns {object|null}
 */
export function mapCodexCredentials(tokens) {
  if (!tokens || typeof tokens !== 'object') return null;
  if (!tokens.access_token) return null;

  return {
    provider: 'codex',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    idToken: tokens.id_token ?? null,
    accountId: tokens.account_id ?? null,
  };
}
