function getRefreshToken(account) {
  return account?.tokens?.refreshToken ?? account?.refreshToken ?? null;
}

function getAccessToken(account) {
  return account?.tokens?.accessToken ?? account?.accessToken ?? null;
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return false;
  return expiry <= Date.now();
}

function mergeRefreshedAccount(account, tokenResponse) {
  const now = new Date();
  const expiresAt = tokenResponse.expiresIn
    ? new Date(now.getTime() + tokenResponse.expiresIn * 1000).toISOString()
    : (account.expiresAt ?? null);

  return {
    ...account,
    tokens: {
      ...account.tokens,
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken ?? getRefreshToken(account),
    },
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken ?? getRefreshToken(account),
    expiresAt,
  };
}

async function refreshEntry(entry, spec) {
  if (!entry?.account) return entry;
  const refreshToken = getRefreshToken(entry.account);
  if (!refreshToken) return entry;

  const tokenResponse = await spec.refreshToken({ refreshToken });
  await spec.updateStoreAfterRefresh(entry.account, tokenResponse);

  const refreshedAccount = mergeRefreshedAccount(entry.account, tokenResponse);
  return {
    account: refreshedAccount,
    profile: spec.mapAccountToProfile(refreshedAccount),
    refresh: {
      attempted: true,
      success: true,
      reason: 'token_refreshed',
    },
  };
}

export async function fetchUsageWithAutoRefresh(entry, spec) {
  let activeEntry = entry;
  let refreshAttempted = false;

  const canRefresh = Boolean(entry?.account && getRefreshToken(entry.account));
  if (canRefresh && isExpired(entry.account.expiresAt)) {
    activeEntry = await refreshEntry(entry, spec);
    refreshAttempted = true;
  }

  let snapshot = await spec.fetchUsage(activeEntry.profile);
  if (canRefresh && !refreshAttempted && snapshot?.status?.bucket === 'auth') {
    activeEntry = await refreshEntry(activeEntry, spec);
    snapshot = await spec.fetchUsage(activeEntry.profile);
  }

  return {
    accountKey: activeEntry.profile.accountKey ?? activeEntry.profile.id,
    account: activeEntry.profile,
    snapshot,
  };
}

export const __testables = {
  isExpired,
  getRefreshToken,
  getAccessToken,
  mergeRefreshedAccount,
};
