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
  /**
   * OAuth authorization endpoint — Claude.ai login flow (observed, pi-ai aligned).
   *
   * Claude Code 바이너리에는 두 종류의 authorize URL이 관찰된다:
   *   - CONSOLE_AUTHORIZE_URL = https://platform.claude.com/oauth/authorize
   *     → API key 발급용 (org:create_api_key 동의 화면)
   *   - CLAUDE_AI_AUTHORIZE_URL = https://claude.ai/oauth/authorize
   *     → claude.ai 사용자 OAuth (~/.claude/.credentials.json에 들어가는 토큰 발급)
   *
   * usage endpoint (api.anthropic.com/api/oauth/usage)는 후자의 토큰을 받으므로
   * 우리는 claude.ai 경로를 사용한다. pi-ai (`@mariozechner/pi-ai`)도 동일 경로를
   * 쓰고 있고, 이전의 `claude.com/cai/oauth/authorize`와 invalid_grant 회귀(이슈 #83)
   * 의심 변수를 줄이기 위해 baseline을 일치시킨다.
   */
  authorizationEndpoint: 'https://claude.ai/oauth/authorize',

  /** OAuth token endpoint — observed, used for both code exchange and refresh */
  tokenEndpoint: 'https://platform.claude.com/v1/oauth/token',

  /** Manual redirect URL shown after login on platform.claude.com */
  manualRedirectUrl: 'https://platform.claude.com/oauth/code/callback',

  /** Success page URL observed after localhost callback */
  successUrl: 'https://platform.claude.com/oauth/code/success?app=claude-code',

  /** snapshot.provider.id 와 fetchClaudeUsage가 표시하는 provider id */
  provider: 'anthropic-claude',

  /**
   * agent-store(`auth.json`)의 providers 키.
   * 기존 import 경로(`auth import claude`)가 'claude' 키에 저장하므로
   * live 로그인도 같은 키에 저장해 한 곳에서 관리한다.
   */
  storeProvider: 'claude',

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
