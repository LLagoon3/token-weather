/**
 * Codex provider account spec.
 *
 * filterFn / mapFn — resolveProviderProfiles에 주입되는 provider-specific 정의.
 */

/**
 * Active, non-mock accounts with a usable access token.
 * @param {object[]} accounts
 * @returns {object[]}
 */
export function filterRealCodexAccounts(accounts) {
  return (accounts ?? []).filter(
    (a) =>
      a.status !== 'disabled' &&
      a.tokens?.accessToken &&
      !a.raw?.mock &&
      !a.tokens.accessToken.startsWith('mock-'),
  );
}

/**
 * Account → fetchCodexUsage profile shape.
 */
export function codexMapAccountToProfile(account) {
  return {
    id: account.accountKey,
    accessToken: account.tokens.accessToken,
    accountId: account.accountId ?? null,
    email: account.email ?? null,
    label: account.label ?? null,
    expires: account.expiresAt ?? null,
  };
}
