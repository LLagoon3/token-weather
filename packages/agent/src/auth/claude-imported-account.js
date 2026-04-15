import { upsertProviderAccount } from './auth-store.js';

const CLAUDE_PROVIDER_ID = 'claude';

/**
 * Builds a minimal auth-store payload from a selectedAccount object
 * imported from the Claude CLI.
 *
 * @param {object | null | undefined} selectedAccount
 * @param {string} [now]
 * @returns {object | null}
 */
export function createClaudeImportedAccountPayload(
  selectedAccount,
  now = new Date().toISOString(),
) {
  if (!selectedAccount) return null;

  return {
    provider: CLAUDE_PROVIDER_ID,
    accountKey: selectedAccount.accountKey,
    email: selectedAccount.email ?? null,
    source: selectedAccount.source ?? 'claude-cli-import',
    authType: selectedAccount.authType ?? 'oauth',
    status: selectedAccount.status ?? 'active',
    createdAt: now,
    updatedAt: now,
    raw: {
      importedFrom: 'claude-cli',
      source: selectedAccount.source ?? 'claude-cli-import',
    },
  };
}

/**
 * Prepares a single account object ready for auth-store insertion.
 * Wraps createClaudeImportedAccountPayload with a reason envelope.
 * No side effects — does not read or write any store.
 *
 * @param {object | null | undefined} selectedAccount
 * @param {string} [now]
 * @returns {{ account: object | null, reason: string }}
 */
export function prepareClaudeImportedAccount(
  selectedAccount,
  now = new Date().toISOString(),
) {
  if (!selectedAccount) {
    return { account: null, reason: 'no-selected-account' };
  }

  const account = createClaudeImportedAccountPayload(selectedAccount, now);
  return { account, reason: 'prepared-import' };
}

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
