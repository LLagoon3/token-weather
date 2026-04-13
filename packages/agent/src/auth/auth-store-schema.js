/**
 * Auth store schema shape and factory functions.
 *
 * Matches the spec defined in docs/auth-store-schema.md.
 */

export const AUTH_STORE_VERSION = 1;

export const AUTH_TYPES = [
  'oauth',
  'session_cookie',
  'session_key',
  'api_key',
  'unknown',
];

export const CREDENTIAL_SOURCES = [
  'agent-store',
  'openclaw-import',
  'env',
  'manual',
];

export function createEmptyAuthStore() {
  return {
    version: AUTH_STORE_VERSION,
    updatedAt: new Date().toISOString(),
    providers: {},
  };
}

export function createAccount({
  accountKey,
  email,
  displayName = null,
  accountId = null,
  authType = 'oauth',
  source = 'agent-store',
  scopes = [],
  tokens = {},
  raw = {},
}) {
  const now = new Date().toISOString();
  return {
    accountKey,
    email,
    displayName,
    accountId,
    authType,
    source,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
    scopes,
    tokens,
    raw,
  };
}
