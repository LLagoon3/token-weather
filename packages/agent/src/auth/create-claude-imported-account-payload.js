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
    provider: 'claude',
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
