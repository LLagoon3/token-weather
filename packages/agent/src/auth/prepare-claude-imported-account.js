import { createClaudeImportedAccountPayload } from './create-claude-imported-account-payload.js';

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
