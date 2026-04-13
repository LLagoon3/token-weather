/**
 * Codex (OpenAI) OAuth provider metadata and constants.
 *
 * NOTE: These values are placeholders based on publicly known OpenAI OAuth patterns.
 * Actual endpoint URLs and client IDs may differ — verify against OpenAI documentation
 * before attempting real OAuth flows.
 */

export const CODEX_AUTH = {
  /** OAuth authorization endpoint (placeholder — verify before real use) */
  authorizationEndpoint: 'https://auth0.openai.com/authorize',

  /** OAuth token endpoint (placeholder — not yet used) */
  tokenEndpoint: 'https://auth0.openai.com/oauth/token',

  /** Provider identifier used in auth store */
  provider: 'openai-codex',

  /** Default scopes to request (placeholder) */
  defaultScopes: ['openid', 'profile', 'email'],

  /** Response type for authorization code flow */
  responseType: 'code',
};
