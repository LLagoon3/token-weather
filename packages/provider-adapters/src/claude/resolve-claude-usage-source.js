import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function resolveClaudeUsageSourcePath(base = os.homedir()) {
  return path.join(base, '.claude', 'stats-cache.json');
}

/**
 * Resolves the local Claude usage data source.
 *
 * Returns a descriptor indicating whether usage data is available and where.
 * Claude Code writes `~/.claude/stats-cache.json` as its local stats artifact.
 * No network call is made.
 *
 * @param {string} [base] - Home directory base (defaults to os.homedir())
 * @returns {{ available: boolean, kind: 'stats-cache-json' | 'not-found', path: string, reason: string }}
 */
export function resolveClaudeUsageSource(base = os.homedir()) {
  const sourcePath = resolveClaudeUsageSourcePath(base);

  if (fs.existsSync(sourcePath)) {
    return {
      available: true,
      kind: 'stats-cache-json',
      path: sourcePath,
      reason: 'found ~/.claude/stats-cache.json written by Claude Code',
    };
  }

  return {
    available: false,
    kind: 'not-found',
    path: sourcePath,
    reason: 'stats-cache.json not found — Claude Code may not have run yet',
  };
}
