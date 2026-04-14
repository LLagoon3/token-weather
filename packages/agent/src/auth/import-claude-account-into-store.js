import { prepareClaudeImportedAccount } from './prepare-claude-imported-account.js';
import { upsertProviderAccount } from './auth-store.js';

const CLAUDE_PROVIDER_ID = 'claude';

/**
 * Pure store transform: imports a Claude selected account into the auth store.
 * No disk I/O — accepts a store object, returns a new store object.
 *
 * @param {object} store - Current auth store (from createEmptyAuthStore or loadAuthStore)
 * @param {object | null | undefined} selectedAccount - Claude CLI selected account
 * @param {string} [now] - ISO timestamp for createdAt/updatedAt
 * @returns {{ store: object, account: object | null, reason: string }}
 */
export function importClaudeAccountIntoStore(
  store,
  selectedAccount,
  now = new Date().toISOString(),
) {
  const { account, reason } = prepareClaudeImportedAccount(selectedAccount, now);

  if (!account) {
    return { store, account: null, reason };
  }

  const nextStore = upsertProviderAccount(store, CLAUDE_PROVIDER_ID, account);
  return { store: nextStore, account, reason: 'store-updated' };
}
