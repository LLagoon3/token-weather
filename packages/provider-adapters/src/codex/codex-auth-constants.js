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
   * Expected localhost callback URL — aligned with OpenClaw observed authorize URL.
   * Port 1455 is the value documented in OpenClaw; our agent may use a different port.
   * Host is `localhost` (not `127.0.0.1`) to match the redirect_uri OpenClaw actually sends.
   */
  callbackUrl: 'http://localhost:1455/auth/callback',

  /** Provider identifier used in auth store */
  provider: 'openai-codex',

  /**
   * Observed client_id from local ~/.codex/auth.json JWT payload.
   * NOT officially confirmed — treat as default candidate, not guaranteed stable.
   */
  observedClientId: 'app_EMoamEEZ73f0CkXaXp7hrann',

  /** Default scopes — aligned with OpenClaw observed authorize URL */
  defaultScopes: ['openid', 'profile', 'email', 'offline_access'],

  /**
   * Extra query parameters observed in OpenClaw's authorize URL.
   * These are not part of the OAuth spec but are sent by the Codex CLI flow.
   * Treat as observed alignment, not officially documented.
   */
  extraAuthorizeParams: {
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    originator: 'pi',
  },

  /** Response type for authorization code flow */
  responseType: 'code',
};
