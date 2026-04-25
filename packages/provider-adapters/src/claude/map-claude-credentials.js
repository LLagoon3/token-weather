/**
 * Maps raw claudeAiOauth object (from ~/.claude/.credentials.json)
 * to a normalized credential shape usable by token-weather.
 *
 * Fields are based on verified/observed structure only.
 */
export function mapClaudeCredentials(claudeAiOauth) {
  if (!claudeAiOauth || typeof claudeAiOauth !== 'object') {
    return null;
  }

  return {
    provider: 'claude',
    accessToken: claudeAiOauth.accessToken ?? null,
    refreshToken: claudeAiOauth.refreshToken ?? null,
    expiresAt: claudeAiOauth.expiresAt ?? null,
    scopes: Array.isArray(claudeAiOauth.scopes) ? claudeAiOauth.scopes : [],
    subscriptionType: claudeAiOauth.subscriptionType ?? null,
    rateLimitTier: claudeAiOauth.rateLimitTier ?? null,
  };
}
