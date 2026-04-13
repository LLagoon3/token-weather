/**
 * Draft / placeholder for Codex (OpenAI) OAuth token exchange.
 *
 * This function will eventually POST the authorization code to the token
 * endpoint and return tokens. Currently it is a **draft skeleton** —
 * the HTTP call is intentionally NOT executed because:
 *
 *   1. The token endpoint (https://auth0.openai.com/oauth/token) is a
 *      placeholder and has not been verified against real OpenAI OAuth infra.
 *   2. We do not yet have a confirmed client_id (or know whether a
 *      client_secret is required for this grant type).
 *   3. PKCE S256 derivation is still a placeholder in localhost-callback.js.
 *
 * ## What this file provides right now
 *
 *   - The function signature and expected parameter / return shapes so the
 *     rest of the codebase (auth-login-command, tests) can import and
 *     type-check against a stable contract.
 *   - Inline documentation of every field the real POST body will need.
 *   - A clear list of UNRESOLVED items that must be answered before the
 *     real HTTP call is wired up.
 *
 * ## Unresolved items (must be answered before real implementation)
 *
 *   - [ ] Confirm actual token endpoint URL.
 *   - [ ] Confirm whether client_secret is required (public vs confidential
 *         client). If public client, client_secret is omitted from the POST.
 *   - [ ] Determine if OpenAI's OAuth uses `audience` parameter.
 *   - [ ] Confirm response JSON shape — does it include `id_token`?
 *   - [ ] Confirm scopes that the token endpoint honours.
 *   - [ ] Determine refresh token rotation policy — does every refresh
 *         response contain a new refresh_token?
 *   - [ ] Implement proper S256 PKCE (currently plain placeholder).
 *
 * @module exchange-codex-authorization-code
 */

import { CODEX_AUTH } from './codex-auth-constants.js';

/**
 * @typedef {object} ExchangeParams
 * @property {string}  code              - The authorization code received from the callback.
 * @property {string}  callbackUrl       - The redirect_uri that was used in the authorization request (must match exactly).
 * @property {string}  codeVerifier      - The PKCE code_verifier that corresponds to the code_challenge sent earlier.
 * @property {string}  [clientId]        - OAuth client_id. Defaults to placeholder.
 * @property {string}  [clientSecret]    - OAuth client_secret, if required (confidential client). Omit for public clients.
 * @property {string}  [tokenEndpoint]   - Override token endpoint URL.
 */

/**
 * @typedef {object} TokenResponse
 * @property {string}  accessToken       - Bearer access token.
 * @property {string}  [refreshToken]    - Refresh token (may be absent for some grant types).
 * @property {string}  [idToken]         - OpenID Connect id_token, if requested.
 * @property {number}  expiresIn         - Token lifetime in seconds.
 * @property {string}  tokenType         - Typically "Bearer".
 * @property {string}  [scope]           - Space-separated granted scopes.
 */

const PLACEHOLDER_CLIENT_ID = 'PLACEHOLDER_CLIENT_ID';

/**
 * Exchange an authorization code for tokens at the Codex (OpenAI) token endpoint.
 *
 * **DRAFT** — currently throws instead of making a real HTTP call.
 * Replace the throw with a real fetch() once the unresolved items above are
 * confirmed.
 *
 * @param {ExchangeParams} params
 * @returns {Promise<TokenResponse>}
 */
export async function exchangeCodexAuthorizationCode({
  code,
  callbackUrl,
  codeVerifier,
  clientId = PLACEHOLDER_CLIENT_ID,
  clientSecret = undefined,
  tokenEndpoint = CODEX_AUTH.tokenEndpoint,
}) {
  // ── Build the POST body that will be sent to the token endpoint ──
  const body = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
    client_id: clientId,
    code_verifier: codeVerifier,
  };

  // Include client_secret only when provided (confidential client flow).
  if (clientSecret) {
    body.client_secret = clientSecret;
  }

  // ── DRAFT GATE ────────────────────────────────────────────────────
  // Remove this block and uncomment the fetch below once:
  //   1. tokenEndpoint is verified
  //   2. clientId is a real registered value
  //   3. PKCE S256 is implemented
  throw new Error(
    '[exchangeCodexAuthorizationCode] DRAFT — real HTTP call is not yet enabled. ' +
    `Would POST to ${tokenEndpoint} with grant_type=authorization_code.`
  );

  // ── Real HTTP call (uncomment when ready) ─────────────────────────
  // const res = await fetch(tokenEndpoint, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  //   body: new URLSearchParams(body).toString(),
  // });
  //
  // if (!res.ok) {
  //   const text = await res.text();
  //   throw new Error(
  //     `Token exchange failed: ${res.status} ${res.statusText} — ${text}`
  //   );
  // }
  //
  // const json = await res.json();
  //
  // return {
  //   accessToken:  json.access_token,
  //   refreshToken: json.refresh_token ?? null,
  //   idToken:      json.id_token ?? null,
  //   expiresIn:    json.expires_in,
  //   tokenType:    json.token_type,
  //   scope:        json.scope ?? null,
  // };
}

/**
 * Build the POST body for a token refresh request.
 *
 * **DRAFT** — not yet called anywhere; included as a reference for the
 * next implementation step (auto-refresh on expired access tokens).
 *
 * @param {object} params
 * @param {string} params.refreshToken
 * @param {string} [params.clientId]
 * @param {string} [params.clientSecret]
 * @param {string} [params.tokenEndpoint]
 * @returns {Promise<TokenResponse>}
 */
export async function refreshCodexToken({
  refreshToken,
  clientId = PLACEHOLDER_CLIENT_ID,
  clientSecret = undefined,
  tokenEndpoint = CODEX_AUTH.tokenEndpoint,
}) {
  const body = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  };

  if (clientSecret) {
    body.client_secret = clientSecret;
  }

  // ── DRAFT GATE ────────────────────────────────────────────────────
  throw new Error(
    '[refreshCodexToken] DRAFT — real HTTP call is not yet enabled. ' +
    `Would POST to ${tokenEndpoint} with grant_type=refresh_token.`
  );

  // ── Real HTTP call (uncomment when ready) ─────────────────────────
  // const res = await fetch(tokenEndpoint, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  //   body: new URLSearchParams(body).toString(),
  // });
  //
  // if (!res.ok) {
  //   const text = await res.text();
  //   throw new Error(
  //     `Token refresh failed: ${res.status} ${res.statusText} — ${text}`
  //   );
  // }
  //
  // const json = await res.json();
  //
  // return {
  //   accessToken:  json.access_token,
  //   refreshToken: json.refresh_token ?? refreshToken,  // rotation 여부에 따라
  //   idToken:      json.id_token ?? null,
  //   expiresIn:    json.expires_in,
  //   tokenType:    json.token_type,
  //   scope:        json.scope ?? null,
  // };
}
