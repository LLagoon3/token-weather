import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatClaudeSection } from '../../src/cli/doctor-command.js';

// ---------------------------------------------------------------------------
// formatClaudeSection — pure display helper
// ---------------------------------------------------------------------------

describe('formatClaudeSection', () => {
  const FAKE_PATH = '/home/user/.claude/.credentials.json';

  it('includes credentialsPath in output', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      authSource: 'claude-cli-import',
      selectedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes(FAKE_PATH)));
  });

  it('shows found=true and parsed=true when credentials exist', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      authSource: 'claude-cli-import',
      selectedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('found') && l.includes('true')));
    assert.ok(lines.some((l) => l.includes('parsed') && l.includes('true')));
    assert.ok(lines.some((l) => l.includes('authSource') && l.includes('claude-cli-import')));
  });

  it('shows found=false and parsed=false when credentials are absent', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
      authSource: 'claude-cli-import',
      selectedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('found') && l.includes('false')));
    assert.ok(lines.some((l) => l.includes('parsed') && l.includes('false')));
  });

  it('returns an array with at least 4 lines', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
      authSource: 'claude-cli-import',
      selectedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.length >= 4);
  });

  it('shows accountKey when selectedAccount is present', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      authSource: 'claude-cli-import',
      selectedAccount: { accountKey: 'claude-cli-import', authType: 'oauth' },
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('accountKey') && l.includes('claude-cli-import')));
  });

  it('shows (없음) for accountKey when selectedAccount is null', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
      authSource: 'claude-cli-import',
      selectedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('accountKey') && l.includes('없음')));
  });

  it('shows (알 수 없음) for authType when selectedAccount is null', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
      authSource: 'claude-cli-import',
      selectedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('authType') && l.includes('알 수 없음')));
  });

  it('shows authType from selectedAccount when present', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      authSource: 'claude-cli-import',
      selectedAccount: { accountKey: 'claude-cli-import', authType: 'oauth' },
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('authType') && l.includes('oauth')));
  });

  it('shows fallback for authType when selectedAccount has no authType', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      authSource: 'claude-cli-import',
      selectedAccount: { accountKey: 'claude-cli-import' },
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('authType') && l.includes('알 수 없음')));
  });

  it('shows usage stats when usage source is stats-cache-json', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      authSource: 'claude-cli-import',
      selectedAccount: null,
      usage: {
        source: 'stats-cache-json',
        totalSessions: 10,
        totalMessages: 200,
        hasModelUsage: true,
        hasDailyModelTokens: false,
      },
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('totalSessions') && l.includes('10')));
    assert.ok(lines.some((l) => l.includes('totalMessages') && l.includes('200')));
    assert.ok(lines.some((l) => l.includes('hasModelUsage') && l.includes('true')));
  });

  it('shows not-found message when usage source is not-found', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
      authSource: 'not-found',
      selectedAccount: null,
      usage: { source: 'not-found' },
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('데이터 없음')));
  });

  it('shows live usage OK with usageWindows when networkUsage succeeded', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      authSource: 'claude-cli-import',
      selectedAccount: null,
      networkUsage: {
        status: { ok: true, httpStatus: 200 },
        usageWindows: [
          { kind: 'five_hour', usedPercent: 25, resetAt: '2026-04-14T14:00:00.000Z' },
          { kind: 'seven_day', usedPercent: 80, resetAt: null },
        ],
      },
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('Claude live usage')));
    assert.ok(lines.some((l) => l.includes('OK (200)')));
    assert.ok(lines.some((l) => l.includes('five_hour') && l.includes('25%')));
    assert.ok(lines.some((l) => l.includes('seven_day') && l.includes('80%')));
  });

  it('shows live usage failure bucket and message when networkUsage failed', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      authSource: 'claude-cli-import',
      selectedAccount: null,
      networkUsage: {
        status: {
          ok: false,
          httpStatus: 403,
          bucket: 'auth_scope',
          message: 'missing scope requirement user:profile',
        },
        usageWindows: [],
      },
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('실패') && l.includes('403') && l.includes('auth_scope')));
    assert.ok(lines.some((l) => l.includes('user:profile')));
  });

  it('shows "호출 안 함" when networkUsage is null', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
      authSource: 'not-found',
      selectedAccount: null,
      networkUsage: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('호출 안 함')));
  });
});
