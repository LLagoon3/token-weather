/**
 * Claude provider account spec.
 *
 * filterFn / mapFn / matchesFilter — provider-specific 정의.
 */

/**
 * Active, non-mock, non-import accounts with a usable access token.
 * claude-cli-import source는 buildClaudeSnapshot 경로가 별도 처리한다.
 */
export function filterClaudeRealAccounts(accounts) {
  return (accounts ?? []).filter((a) => {
    if (a.status === 'disabled') return false;
    if (a.raw?.mock === true) return false;
    const accessToken = a.tokens?.accessToken ?? a.accessToken ?? null;
    if (!accessToken) return false;
    if (a.source === 'claude-cli-import') return false;
    return true;
  });
}

/**
 * Account → fetchClaudeUsage profile shape.
 */
export function claudeMapAccountToProfile(account) {
  return {
    id: account.accountKey,
    accountKey: account.accountKey,
    accessToken: account.tokens?.accessToken ?? account.accessToken ?? null,
    accountId: account.accountId ?? null,
    email: account.email ?? null,
    displayName: account.displayName ?? null,
    label: account.label ?? null,
  };
}

/**
 * Single profile이 accountFilter에 매치되는지 판별.
 * cli-import fallback에서 사용.
 */
export function matchesFilter(profile, accountFilter) {
  if (!accountFilter) return true;
  const needle = String(accountFilter).toLowerCase();
  return (
    (profile.id ?? '').toLowerCase() === needle ||
    (profile.email ?? '').toLowerCase() === needle ||
    (profile.label ?? '').toLowerCase() === needle
  );
}
