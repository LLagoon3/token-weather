import { buildImportedClaudeAccount } from './build-imported-account.js';

/**
 * Wraps an imported Claude CLI credential into a selectable account list.
 *
 * Returns `[account]` if the raw oauth object produces a valid account,
 * `[]` otherwise. Pure — no store writes.
 *
 * @param {object|null|undefined} claudeAiOauth  Raw claudeAiOauth from credentials file
 * @returns {Array<object>}
 */
export function resolveImportedClaudeAccounts(claudeAiOauth) {
  const account = buildImportedClaudeAccount(claudeAiOauth);
  return account ? [account] : [];
}
