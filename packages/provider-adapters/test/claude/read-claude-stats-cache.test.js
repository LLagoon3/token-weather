import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readClaudeStatsCache } from '../../src/claude/read-claude-stats-cache.js';

describe('readClaudeStatsCache', () => {
  it('returns null when file does not exist', () => {
    const nonExistent = path.join(os.tmpdir(), `no-such-stats-cache-${Date.now()}.json`);
    assert.equal(readClaudeStatsCache(nonExistent), null);
  });

  it('returns null when file contains invalid JSON', () => {
    const tmpFile = path.join(os.tmpdir(), `stats-cache-bad-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, 'not-json', 'utf8');
    try {
      assert.equal(readClaudeStatsCache(tmpFile), null);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('returns null when file contains non-object JSON', () => {
    const tmpFile = path.join(os.tmpdir(), `stats-cache-prim-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, '42', 'utf8');
    try {
      assert.equal(readClaudeStatsCache(tmpFile), null);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('reads and parses a valid stats-cache file', () => {
    const payload = { version: 3, totalSessions: 10, totalMessages: 200 };
    const tmpFile = path.join(os.tmpdir(), `stats-cache-valid-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(payload), 'utf8');
    try {
      const result = readClaudeStatsCache(tmpFile);
      assert.equal(result.version, 3);
      assert.equal(result.totalSessions, 10);
      assert.equal(result.totalMessages, 200);
      assert.equal(result.hasModelUsage, false);
      assert.equal(result.hasDailyModelTokens, false);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('detects modelUsage and dailyModelTokens when present', () => {
    const payload = {
      version: 3,
      totalSessions: 5,
      totalMessages: 50,
      modelUsage: { 'claude-opus-4-6': 5 },
      dailyModelTokens: { '2026-04-14': {} },
    };
    const tmpFile = path.join(os.tmpdir(), `stats-cache-full-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(payload), 'utf8');
    try {
      const result = readClaudeStatsCache(tmpFile);
      assert.equal(result.hasModelUsage, true);
      assert.equal(result.hasDailyModelTokens, true);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
