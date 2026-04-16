/**
 * @param {unknown} raw
 * @returns {{ version: number|null, totalSessions: number|null, totalMessages: number|null, hasModelUsage: boolean, hasDailyModelTokens: boolean, raw: unknown } | null}
 */
export function parseClaudeStatsCache(raw) {
  if (raw === null || typeof raw !== 'object') return null;

  const num = (v) => (typeof v === 'number' ? v : null);

  return {
    version: num(raw.version),
    totalSessions: num(raw.totalSessions),
    totalMessages: num(raw.totalMessages),
    hasModelUsage: raw.modelUsage !== null && typeof raw.modelUsage === 'object',
    hasDailyModelTokens:
      raw.dailyModelTokens !== null && typeof raw.dailyModelTokens === 'object',
    raw,
  };
}
