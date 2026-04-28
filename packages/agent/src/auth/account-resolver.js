/**
 * Account resolver — selects a default account from a provider's account list.
 *
 * Selection rules (docs/auth-store-schema.md):
 *  1. Single account → auto-select
 *  2. Multiple accounts → most recent lastUsedAt among active accounts
 *  3. --account flag override via resolveAccountByIdentifier()
 */

/**
 * Filter accounts whose status is 'active' (or has no status field, for
 * backward-compat with accounts created before the status field existed).
 */
function filterActiveAccounts(accounts) {
  return accounts.filter((a) => !a.status || a.status === 'active');
}

/**
 * Pick the default account for a given provider.
 *
 * @param {object[]} accounts - provider.accounts array
 * @returns {{ account: object | null, reason: string }}
 */
export function resolveDefaultAccount(accounts) {
  if (!accounts || accounts.length === 0) {
    return { account: null, reason: 'no-accounts' };
  }

  const active = filterActiveAccounts(accounts);

  if (active.length === 0) {
    return { account: null, reason: 'all-disabled' };
  }

  if (active.length === 1) {
    return { account: active[0], reason: 'single-account' };
  }

  // Multiple active accounts → prefer most-recently used.
  // Fallback chain: lastUsedAt → updatedAt → createdAt
  // This prevents selection from depending on array insertion order.
  const sorted = [...active].sort((a, b) => {
    const ta = a.lastUsedAt ?? a.updatedAt ?? a.createdAt ?? '';
    const tb = b.lastUsedAt ?? b.updatedAt ?? b.createdAt ?? '';
    if (ta === tb) return 0;
    return ta > tb ? -1 : 1;
  });

  return { account: sorted[0], reason: 'most-recent' };
}

/**
 * Find an account by email, accountKey, or label (for --account / --label override).
 * 매치는 case-insensitive.
 *
 * @param {object[]} accounts - provider.accounts array
 * @param {string} identifier - email / accountKey / label
 * @returns {{ account: object | null, reason: string }}
 */
export function resolveAccountByIdentifier(accounts, identifier) {
  if (!accounts || accounts.length === 0) {
    return { account: null, reason: 'no-accounts' };
  }

  const needle = String(identifier).toLowerCase();
  const match = accounts.find(
    (a) =>
      (a.email ?? '').toLowerCase() === needle ||
      (a.accountKey ?? '').toLowerCase() === needle ||
      (a.label ?? '').toLowerCase() === needle,
  );

  if (!match) {
    return { account: null, reason: 'not-found' };
  }

  if (match.status === 'disabled') {
    return { account: null, reason: 'account-disabled' };
  }

  return { account: match, reason: 'explicit-selection' };
}

/**
 * High-level resolver combining explicit override + default fallback.
 *
 * @param {object[]} accounts - provider.accounts array
 * @param {{ accountIdentifier?: string }} [options]
 * @returns {{ account: object | null, reason: string }}
 */
export function resolveAccount(accounts, options = {}) {
  if (options.accountIdentifier) {
    return resolveAccountByIdentifier(accounts, options.accountIdentifier);
  }
  return resolveDefaultAccount(accounts);
}
