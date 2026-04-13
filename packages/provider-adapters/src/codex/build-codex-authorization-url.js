/**
 * Build the Codex (OpenAI) OAuth authorization URL.
 *
 * This generates the URL that the user should open in a browser to start the
 * OAuth authorization code flow. It does NOT perform any HTTP calls.
 *
 * NOTE: The generated URL uses verified auth.openai.com endpoints and an
 * observed client_id candidate from the local Codex CLI token payload.
 * The client_id is still not officially confirmed, so success is not guaranteed.
 *
 * @param {object} params
 * @param {string} params.callbackUrl - The localhost redirect_uri
 * @param {string} params.state - OAuth state parameter for CSRF protection
 * @param {string} params.codeChallenge - PKCE code_challenge value
 * @param {string} params.codeChallengeMethod - PKCE method ('plain' or 'S256')
 * @param {string} [params.clientId] - Override client ID (default: observed candidate)
 * @param {string[]} [params.scopes] - Override scopes (default: CODEX_AUTH.defaultScopes)
 * @returns {string} The full authorization URL with query parameters
 */

import { CODEX_AUTH } from './codex-auth-constants.js';

export function buildCodexAuthorizationUrl({
  callbackUrl,
  state,
  codeChallenge,
  codeChallengeMethod,
  clientId = CODEX_AUTH.observedClientId,
  scopes = CODEX_AUTH.defaultScopes,
}) {
  const url = new URL(CODEX_AUTH.authorizationEndpoint);

  url.searchParams.set('response_type', CODEX_AUTH.responseType);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', codeChallengeMethod);

  // Extra params observed in OpenClaw's authorize URL (not OAuth spec)
  const extra = CODEX_AUTH.extraAuthorizeParams ?? {};
  for (const [key, value] of Object.entries(extra)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}
