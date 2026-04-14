import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  resolveClaudeUsageSourcePath,
  resolveClaudeUsageSource,
} from '../../src/claude/resolve-claude-usage-source.js';

describe('resolveClaudeUsageSourcePath', () => {
  it('joins base with .claude/stats-cache.json', () => {
    const result = resolveClaudeUsageSourcePath('/home/user');
    assert.equal(result, path.join('/home/user', '.claude', 'stats-cache.json'));
  });

  it('defaults to os.homedir() when no base is given', () => {
    const result = resolveClaudeUsageSourcePath();
    assert.equal(result, path.join(os.homedir(), '.claude', 'stats-cache.json'));
  });
});

describe('resolveClaudeUsageSource', () => {
  it('returns not-found when stats-cache.json is absent', () => {
    const base = path.join(os.tmpdir(), `claude-usage-test-absent-${Date.now()}`);
    const result = resolveClaudeUsageSource(base);

    assert.equal(result.available, false);
    assert.equal(result.kind, 'not-found');
    assert.equal(result.path, path.join(base, '.claude', 'stats-cache.json'));
    assert.ok(result.reason.length > 0);
  });

  it('returns stats-cache-json when the file exists', () => {
    const base = path.join(os.tmpdir(), `claude-usage-test-present-${Date.now()}`);
    const claudeDir = path.join(base, '.claude');
    const cacheFile = path.join(claudeDir, 'stats-cache.json');

    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify({ version: 3, totalSessions: 1 }), 'utf8');

    try {
      const result = resolveClaudeUsageSource(base);
      assert.equal(result.available, true);
      assert.equal(result.kind, 'stats-cache-json');
      assert.equal(result.path, cacheFile);
      assert.ok(result.reason.length > 0);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  it('result shape always has all four fields', () => {
    const base = path.join(os.tmpdir(), `claude-usage-test-shape-${Date.now()}`);
    const result = resolveClaudeUsageSource(base);

    assert.ok('available' in result);
    assert.ok('kind' in result);
    assert.ok('path' in result);
    assert.ok('reason' in result);
  });
});
