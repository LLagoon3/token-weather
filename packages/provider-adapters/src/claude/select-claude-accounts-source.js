/**
 * Selects the active accounts and authSource based on priority:
 *   1. agentAccounts (agent-store)
 *   2. importedAccounts (claude-cli-import)
 *   3. empty (not-found)
 *
 * @param {Array} agentAccounts
 * @param {Array} importedAccounts
 * @returns {{ accounts: Array, authSource: string }}
 */
export function selectClaudeAccountsSource(agentAccounts, importedAccounts) {
  if (agentAccounts.length > 0) {
    return { accounts: agentAccounts, authSource: 'agent-store' };
  }
  if (importedAccounts.length > 0) {
    return { accounts: importedAccounts, authSource: 'claude-cli-import' };
  }
  return { accounts: [], authSource: 'not-found' };
}
