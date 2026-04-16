import fs from 'node:fs';
import { resolveClaudeUsageSourcePath } from './resolve-claude-usage-source.js';
import { parseClaudeStatsCache } from './parse-claude-stats-cache.js';

/**
 * stats-cache.json을 읽어 파싱된 결과를 반환한다.
 * 파일이 없거나 JSON 파싱 실패 시 null을 반환한다.
 *
 * @param {string} [sourcePath] - stats-cache.json 경로 (기본값: resolveClaudeUsageSourcePath())
 * @returns {{ version: number|null, totalSessions: number|null, totalMessages: number|null, hasModelUsage: boolean, hasDailyModelTokens: boolean, raw: unknown } | null}
 */
export function readClaudeStatsCache(sourcePath = resolveClaudeUsageSourcePath()) {
  if (!fs.existsSync(sourcePath)) {
    return null;
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch {
    return null;
  }

  return parseClaudeStatsCache(raw);
}
