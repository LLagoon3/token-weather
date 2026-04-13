/**
 * Codex (OpenAI) OAuth provider metadata and constants.
 *
 * Verified sources:
 * - OpenClaw docs/concepts/oauth.md (authorize, token, callback URLs)
 * - OpenClaw provider-openai-codex-oauth-tls-*.js (authorize URL preflight)
 * - Local ~/.codex/auth.json JWT payload (iss, client_id)
 *
 * See inline comments for confidence level of each value.
 */

export const CODEX_AUTH = {
  /** OAuth authorization endpoint — verified via OpenClaw docs + code */
  authorizationEndpoint: 'https://auth.openai.com/oauth/authorize',

  /** OAuth token endpoint — verified via OpenClaw docs/concepts/oauth.md */
  tokenEndpoint: 'https://auth.openai.com/oauth/token',

  /**
   * Expected localhost callback URL — verified via OpenClaw docs/concepts/oauth.md.
   * Port 1455 is the value documented in OpenClaw; our agent may use a different port.
   */
  callbackUrl: 'http://127.0.0.1:1455/auth/callback',

  /** Provider identifier used in auth store */
  provider: 'openai-codex',

  /**
   * Observed client_id from local ~/.codex/auth.json JWT payload.
   * NOT officially confirmed — treat as default candidate, not guaranteed stable.
   */
  observedClientId: 'app_EMoamEEZ73f0CkXaXp7hrann',

  /** Default scopes to request (placeholder — not yet verified against provider) */
  defaultScopes: ['openid', 'profile', 'email'],

  /** Response type for authorization code flow */
  responseType: 'code',
};
