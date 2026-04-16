import { mapClaudeCredentials } from './map-claude-credentials.js';

/**
 * Maps a raw claudeAiOauth object to the minimal internal account shape
 * used when credentials were imported from the Claude CLI.
 *
 * Does NOT write to any store — pure transform only.
 */
export function buildImportedClaudeAccount(claudeAiOauth) {
  const cred = mapClaudeCredentials(claudeAiOauth);
  if (!cred) return null;

  return {
    provider: 'claude',
    source: 'claude-cli-import',
    accountKey: 'claude-cli-import',
    authType: 'oauth',
    accessToken: cred.accessToken,
    refreshToken: cred.refreshToken,
    expiresAt: cred.expiresAt,
    scopes: cred.scopes,
    subscriptionType: cred.subscriptionType,
    rateLimitTier: cred.rateLimitTier,
  };
}

/**
 * Wraps an imported Claude CLI credential into a selectable account list.
 *
 * Returns `[account]` if the raw oauth object produces a valid account,
 * `[]` otherwise. Pure — no store writes.
 *
 * @param {object|null|undefined} claudeAiOauth
 * @returns {Array<object>}
 */
export function resolveImportedClaudeAccounts(claudeAiOauth) {
  const account = buildImportedClaudeAccount(claudeAiOauth);
  return account ? [account] : [];
}

/**
 * Selects the active accounts and authSource based on priority:
 *   1. agentAccounts (agent-store)
 *   2. importedAccounts (claude-cli-import)
 *   3. empty (not-found)
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

/**
 * Thin facade: given a raw claudeAiOauth object, returns the imported
 * account list and the resolved authSource in one call.
 *
 * Pure — no store writes, no I/O.
 *
 * @param {object|null|undefined} claudeAiOauth
 * @returns {{ accounts: Array<object>, authSource: string }}
 */
export function resolveImportedClaudeSnapshot(claudeAiOauth) {
  const importedAccounts = resolveImportedClaudeAccounts(claudeAiOauth);
  return selectClaudeAccountsSource([], importedAccounts);
}
