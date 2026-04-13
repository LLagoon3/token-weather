/**
 * JWT payload decoding and account-identity claim extraction.
 *
 * Only decodes the payload portion of a JWT (no signature verification).
 * This is acceptable here because the tokens were received directly from the
 * token endpoint over TLS — we are reading our own tokens for account
 * identification, not validating tokens from an untrusted source.
 *
 * @module token-claims
 */

/**
 * Decode the payload of a JWT without signature verification.
 * Returns `null` if the input is not a valid 3-part JWT or if base64 decoding fails.
 *
 * @param {string} jwt
 * @returns {object|null}
 */
export function decodeJwtPayload(jwt) {
  if (typeof jwt !== 'string') return null;

  const parts = jwt.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * @typedef {object} AccountIdentity
 * @property {string}      email      - Best available email (or fallback).
 * @property {string|null}  accountId  - `sub` claim or null.
 * @property {string|null}  displayName - `name` or `preferred_username` or null.
 * @property {string}      claimSource - Which token/field the identity was derived from.
 */

/**
 * Extract account-identity fields from token response claims.
 *
 * Priority order:
 *   1. id_token payload  — email → preferred_username → sub
 *   2. access_token payload (if decodable JWT) — same field priority
 *   3. fallback — code-prefix-based placeholder
 *
 * Not all providers include all claims. The `claimSource` field records which
 * source was actually used so callers can log/audit it.
 *
 * @param {object} params
 * @param {string|null} params.idToken       - Raw id_token string (may be null).
 * @param {string|null} params.accessToken   - Raw access_token string (may be null).
 * @param {string}      params.fallbackCode  - Authorization code, used for last-resort fallback.
 * @returns {AccountIdentity}
 */
export function extractAccountIdentity({ idToken, accessToken, fallbackCode }) {
  // --- try id_token first ---
  const idClaims = decodeJwtPayload(idToken);
  if (idClaims) {
    const identity = identityFromClaims(idClaims, 'id_token');
    if (identity) return identity;
  }

  // --- try access_token (some providers issue JWTs) ---
  const atClaims = decodeJwtPayload(accessToken);
  if (atClaims) {
    const identity = identityFromClaims(atClaims, 'access_token');
    if (identity) return identity;
  }

  // --- fallback: code-prefix placeholder ---
  const suffix = (fallbackCode ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8) || 'live';
  return {
    email: `live-${suffix}@codex.openai.com`,
    accountId: null,
    displayName: null,
    claimSource: 'fallback:code-prefix',
  };
}

/**
 * Try to build an identity from decoded JWT claims.
 * Returns null if no usable identifier is found.
 *
 * @param {object} claims
 * @param {string} source - label like 'id_token' or 'access_token'
 * @returns {AccountIdentity|null}
 */
function identityFromClaims(claims, source) {
  const email = claims.email ?? null;
  const preferredUsername = claims.preferred_username ?? null;
  const sub = claims.sub ?? null;
  const name = claims.name ?? null;

  // We need at least one usable identifier.
  const bestEmail = email ?? preferredUsername ?? (sub ? `${sub}@codex.openai.com` : null);
  if (!bestEmail) return null;

  return {
    email: bestEmail,
    accountId: sub ?? null,
    displayName: name ?? preferredUsername ?? null,
    claimSource: email ? `${source}:email`
      : preferredUsername ? `${source}:preferred_username`
      : `${source}:sub`,
  };
}
