import { resolveImportedClaudeAccounts } from './resolve-imported-claude-accounts.js';
import { selectClaudeAccountsSource } from './select-claude-accounts-source.js';

/**
 * Thin facade: given a raw claudeAiOauth object, returns the imported
 * account list and the resolved authSource in one call.
 *
 * Pure — no store writes, no I/O.
 *
 * @param {object|null|undefined} claudeAiOauth  Raw claudeAiOauth from credentials file
 * @returns {{ accounts: Array<object>, authSource: string }}
 */
export function resolveImportedClaudeSnapshot(claudeAiOauth) {
  const importedAccounts = resolveImportedClaudeAccounts(claudeAiOauth);
  return selectClaudeAccountsSource([], importedAccounts);
}
