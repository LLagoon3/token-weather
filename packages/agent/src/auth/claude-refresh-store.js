import { loadAuthStore, saveAuthStore, upsertProviderAccount } from './auth-store.js';
import { CLAUDE_AUTH } from '../../../provider-adapters/src/claude/claude-auth-constants.js';

/**
 * Claude refresh 성공 후 agent-store 갱신.
 *
 * @param {object} account - 갱신 대상 account 원본
 * @param {object} tokenResponse - refreshClaudeToken 결과
 * @returns {Promise<{ accountKey: string, expiresAt: string|null }>}
 */
export async function updateClaudeStoreAfterRefresh(account, tokenResponse) {
  const now = new Date();
  const expiresAt = tokenResponse.expiresIn
    ? new Date(now.getTime() + tokenResponse.expiresIn * 1000).toISOString()
    : null;

  const updatedAccount = {
    ...account,
    tokens: {
      ...account.tokens,
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
    },
    expiresAt,
    updatedAt: now.toISOString(),
    lastUsedAt: now.toISOString(),
    raw: {
      ...account.raw,
      lastRefreshedAt: now.toISOString(),
      scope: tokenResponse.scope ?? account.raw?.scope ?? null,
      tokenType: tokenResponse.tokenType ?? account.raw?.tokenType ?? null,
    },
  };

  const freshStore = await loadAuthStore();
  const nextStore = upsertProviderAccount(freshStore, CLAUDE_AUTH.storeProvider, updatedAccount);
  await saveAuthStore(nextStore);

  return { accountKey: updatedAccount.accountKey, expiresAt };
}
