/**
 * Codex (OpenAI) OAuth token exchange — guarded real fetch.
 *
 * Both `exchangeCodexAuthorizationCode()` and `refreshCodexToken()` contain
 * a fully wired fetch path, but it is **guarded by default**: callers must
 * pass `allowLiveExchange: true` to actually hit the network.  Without that
 * flag the functions throw a descriptive error — identical to the previous
 * draft behaviour — so nothing changes for existing call-sites.
 *
 * ## Why the guard exists
 *
 *   - client_id (`app_EMoamEEZ73f0CkXaXp7hrann`) is an observed value, not
 *     officially confirmed by OpenAI.
 *   - PKCE S256 derivation is still a placeholder in localhost-callback.js.
 *   - We want the live path exercisable in dev/test without risking
 *     accidental external calls in production.
 *
 * ## Remaining unresolved items
 *
 *   - [ ] Confirm whether client_secret is required (public vs confidential).
 *   - [ ] Determine if OpenAI's OAuth uses the `audience` parameter.
 *   - [ ] Confirm response JSON shape — does it include `id_token`?
 *   - [ ] Confirm scopes the token endpoint honours.
 *   - [ ] Determine refresh token rotation policy.
 *   - [ ] Implement proper S256 PKCE (currently plain placeholder).
 *
 * @module exchange-codex-authorization-code
 */

import { CODEX_AUTH } from './codex-auth-constants.js';

/**
 * @typedef {object} ExchangeParams
 * @property {string}  code              - The authorization code received from the callback.
 * @property {string}  callbackUrl       - The redirect_uri used in the authorization request (must match exactly).
 * @property {string}  codeVerifier      - The PKCE code_verifier corresponding to the code_challenge sent earlier.
 * @property {boolean} [allowLiveExchange=false] - Set to `true` to perform a real HTTP POST. Without this the function throws.
 * @property {string}  [clientId]        - OAuth client_id. Defaults to observed candidate.
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

/**
 * Exchange an authorization code for tokens at the Codex (OpenAI) token endpoint.
 *
 * By default this function is **guarded** and will throw without making any
 * network request.  Pass `allowLiveExchange: true` to perform the real POST.
 *
 * @param {ExchangeParams} params
 * @returns {Promise<TokenResponse>}
 */
export async function exchangeCodexAuthorizationCode({
  code,
  callbackUrl,
  codeVerifier,
  allowLiveExchange = false,
  clientId = CODEX_AUTH.observedClientId,
  clientSecret = undefined,
  tokenEndpoint = CODEX_AUTH.tokenEndpoint,
}) {
  const body = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
    client_id: clientId,
    code_verifier: codeVerifier,
  };

  if (clientSecret) {
    body.client_secret = clientSecret;
  }

  // ── Guard: block live fetch unless explicitly opted-in ─────────────
  if (!allowLiveExchange) {
    throw new Error(
      '[exchangeCodexAuthorizationCode] Live exchange is disabled. ' +
      'Pass { allowLiveExchange: true } to perform a real POST to ' +
      `${tokenEndpoint} (grant_type=authorization_code). ` +
      'Note: client_id is an observed value and not officially confirmed.',
    );
  }

  // ── Real HTTP call ────────────────────────────────────────────────
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Token exchange failed: ${res.status} ${res.statusText} — ${text}`,
    );
  }

  const json = await res.json();

  return {
    accessToken:  json.access_token,
    refreshToken: json.refresh_token ?? null,
    idToken:      json.id_token ?? null,
    expiresIn:    json.expires_in,
    tokenType:    json.token_type,
    scope:        json.scope ?? null,
  };
}

/**
 * @typedef {object} RefreshParams
 * @property {string}  refreshToken      - The refresh token to exchange.
 * @property {boolean} [allowLiveExchange=false] - Set to `true` to perform a real HTTP POST.
 * @property {string}  [clientId]        - OAuth client_id. Defaults to observed candidate.
 * @property {string}  [clientSecret]    - OAuth client_secret, if required.
 * @property {string}  [tokenEndpoint]   - Override token endpoint URL.
 */

/**
 * Refresh an access token using a refresh token.
 *
 * Guarded identically to {@link exchangeCodexAuthorizationCode} — pass
 * `allowLiveExchange: true` to perform the real POST.
 *
 * @param {RefreshParams} params
 * @returns {Promise<TokenResponse>}
 */
export async function refreshCodexToken({
  refreshToken,
  allowLiveExchange = false,
  clientId = CODEX_AUTH.observedClientId,
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

  // ── Guard: block live fetch unless explicitly opted-in ─────────────
  if (!allowLiveExchange) {
    throw new Error(
      '[refreshCodexToken] Live exchange is disabled. ' +
      'Pass { allowLiveExchange: true } to perform a real POST to ' +
      `${tokenEndpoint} (grant_type=refresh_token). ` +
      'Note: client_id is an observed value and not officially confirmed.',
    );
  }

  // ── Real HTTP call ────────────────────────────────────────────────
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Token refresh failed: ${res.status} ${res.statusText} — ${text}`,
    );
  }

  const json = await res.json();

  return {
    accessToken:  json.access_token,
    refreshToken: json.refresh_token ?? refreshToken, // rotation 여부에 따라 기존 토큰 유지
    idToken:      json.id_token ?? null,
    expiresIn:    json.expires_in,
    tokenType:    json.token_type,
    scope:        json.scope ?? null,
  };
}
