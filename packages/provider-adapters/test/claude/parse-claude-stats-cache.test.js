import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseClaudeStatsCache } from '../../src/claude/parse-claude-stats-cache.js';

describe('parseClaudeStatsCache', () => {
  it('returns null for null', () => {
    assert.equal(parseClaudeStatsCache(null), null);
  });

  it('returns null for undefined', () => {
    assert.equal(parseClaudeStatsCache(undefined), null);
  });

  it('returns null for non-object primitives', () => {
    assert.equal(parseClaudeStatsCache(42), null);
    assert.equal(parseClaudeStatsCache('string'), null);
    assert.equal(parseClaudeStatsCache(true), null);
  });

  it('extracts version, totalSessions, totalMessages from valid object', () => {
    const raw = { version: 3, totalSessions: 10, totalMessages: 200 };
    const result = parseClaudeStatsCache(raw);

    assert.equal(result.version, 3);
    assert.equal(result.totalSessions, 10);
    assert.equal(result.totalMessages, 200);
    assert.equal(result.raw, raw);
  });

  it('sets hasModelUsage true when modelUsage is an object', () => {
    const result = parseClaudeStatsCache({ modelUsage: { 'claude-3': 5 } });
    assert.equal(result.hasModelUsage, true);
  });

  it('sets hasModelUsage false when modelUsage is absent or non-object', () => {
    assert.equal(parseClaudeStatsCache({}).hasModelUsage, false);
    assert.equal(parseClaudeStatsCache({ modelUsage: null }).hasModelUsage, false);
    assert.equal(parseClaudeStatsCache({ modelUsage: 'x' }).hasModelUsage, false);
  });

  it('sets hasDailyModelTokens true when dailyModelTokens is an object', () => {
    const result = parseClaudeStatsCache({ dailyModelTokens: { '2026-04-14': {} } });
    assert.equal(result.hasDailyModelTokens, true);
  });

  it('sets hasDailyModelTokens false when dailyModelTokens is absent or non-object', () => {
    assert.equal(parseClaudeStatsCache({}).hasDailyModelTokens, false);
    assert.equal(parseClaudeStatsCache({ dailyModelTokens: null }).hasDailyModelTokens, false);
    assert.equal(parseClaudeStatsCache({ dailyModelTokens: 0 }).hasDailyModelTokens, false);
  });

  it('falls back to null for non-number fields', () => {
    const result = parseClaudeStatsCache({
      version: 'v3',
      totalSessions: null,
      totalMessages: undefined,
    });
    assert.equal(result.version, null);
    assert.equal(result.totalSessions, null);
    assert.equal(result.totalMessages, null);
  });
});
