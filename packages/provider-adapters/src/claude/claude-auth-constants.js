/**
 * Claude (Anthropic) OAuth provider metadata and constants.
 *
 * 값들은 Claude Code CLI 바이너리(`~/.local/share/claude/versions/<v>`)에서
 * observed한 결과를 그대로 옮긴 것이다. 공식 문서에 기재된 값이 아니므로
 * "observed" 레벨로 간주하고, 실패 시 최신 바이너리 기준으로 재검증해야 한다.
 *
 * Source: strings dump of claude-code v2.1.107 (2026-04-14)
 */

export const CLAUDE_AUTH = {
  /** OAuth authorization endpoint — observed (production claude-code client) */
  authorizationEndpoint: 'https://platform.claude.com/oauth/authorize',

  /** OAuth token endpoint — observed, used for both code exchange and refresh */
  tokenEndpoint: 'https://platform.claude.com/v1/oauth/token',

  /** Manual redirect URL shown after login on platform.claude.com */
  manualRedirectUrl: 'https://platform.claude.com/oauth/code/callback',

  /** Success page URL observed after localhost callback */
  successUrl: 'https://platform.claude.com/oauth/code/success?app=claude-code',

  /** Provider identifier used in agent auth store */
  provider: 'anthropic-claude',

  /**
   * Observed claude-code production client_id.
   * Source: strings dump `CLIENT_ID:"9d1c250a-e61b-44d9-88ed-5944d1962f5e"`.
   * NOT officially documented — treat as observed default.
   */
  observedClientId: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',

  /** Default scopes (관찰 대상 — 이후 authorize flow 구현 시 실측으로 보정) */
  defaultScopes: ['org:create_api_key', 'user:profile', 'user:inference'],

  /** Response type for authorization code flow */
  responseType: 'code',
};
