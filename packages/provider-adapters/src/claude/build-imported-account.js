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
