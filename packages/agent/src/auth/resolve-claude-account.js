import { resolveAccount } from './account-resolver.js';
import { resolveAuthSource } from '../services/auth-source-resolver.js';

/**
 * Picks the active Claude account from agent-store accounts (priority) or
 * imported Claude CLI accounts (fallback), then resolves a single account.
 *
 * @param {object[]} agentClaudeAccounts   - Claude accounts from auth-store
 * @param {object[]} importedClaudeAccounts - Claude accounts from claude-cli-import
 * @param {{ accountIdentifier?: string }} [options]
 * @returns {{ account: object | null, authSource: string, reason: string }}
 */
export function resolveClaudeAccount(
  agentClaudeAccounts,
  importedClaudeAccounts,
  options = {},
) {
  const { accounts, authSource } = resolveAuthSource(agentClaudeAccounts, [
    { id: 'claude-cli-import', accounts: importedClaudeAccounts },
  ]);

  const { account, reason } = resolveAccount(accounts, options);
  return { account, authSource, reason };
}
