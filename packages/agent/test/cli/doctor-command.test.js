import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatClaudeSection,
  parseDoctorClaudeOptions,
  formatDoctorHelp,
  formatDoctorCodexHelp,
  formatDoctorClaudeHelp,
} from '../../src/cli/doctor-command.js';

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
    assert.ok(
      lines.some((l) => l.includes('실패') && l.includes('403') && l.includes('auth_scope')),
    );
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

describe('parseDoctorClaudeOptions', () => {
  // 모든 default 필드 — issue #37 에서 dedupe / apply / backfillAccountId 추가.
  const DEFAULTS = {
    refreshLive: false,
    account: null,
    dedupe: false,
    apply: false,
    backfillAccountId: false,
    help: false,
  };

  it('returns defaults', () => {
    assert.deepEqual(parseDoctorClaudeOptions([]), DEFAULTS);
  });

  it('sets refreshLive=true when --refresh-live is present', () => {
    assert.deepEqual(parseDoctorClaudeOptions(['--refresh-live']), {
      ...DEFAULTS,
      refreshLive: true,
    });
  });

  it('handles mixed / unknown args gracefully', () => {
    assert.deepEqual(parseDoctorClaudeOptions(['--foo', '--refresh-live', 'bar']), {
      ...DEFAULTS,
      refreshLive: true,
    });
  });

  it('handles null/undefined args', () => {
    assert.deepEqual(parseDoctorClaudeOptions(undefined), DEFAULTS);
    assert.deepEqual(parseDoctorClaudeOptions(null), DEFAULTS);
  });

  it('parses --account <value>', () => {
    assert.deepEqual(parseDoctorClaudeOptions(['--refresh-live', '--account', 'work']), {
      ...DEFAULTS,
      refreshLive: true,
      account: 'work',
    });
  });

  it('ignores --account without value', () => {
    assert.deepEqual(parseDoctorClaudeOptions(['--account']), DEFAULTS);
  });

  it('treats --account "" as "no value" and lets subsequent flags parse (legacy contract)', () => {
    // 공통 helper 전환 후에도 빈 문자열은 default 유지하고 consume하지 않아
    // 이어지는 --refresh-live가 정상 파싱되어야 한다.
    assert.deepEqual(parseDoctorClaudeOptions(['--account', '', '--refresh-live']), {
      ...DEFAULTS,
      refreshLive: true,
    });
  });

  it('parses --dedupe / --apply / --backfill-account-id (issue #37)', () => {
    assert.deepEqual(
      parseDoctorClaudeOptions(['--dedupe', '--apply', '--backfill-account-id']),
      {
        ...DEFAULTS,
        dedupe: true,
        apply: true,
        backfillAccountId: true,
      },
    );
  });

  it('recognizes --help and -h', () => {
    assert.equal(parseDoctorClaudeOptions(['--help']).help, true);
    assert.equal(parseDoctorClaudeOptions(['-h']).help, true);
  });
});

describe('formatDoctorHelp', () => {
  it('first line covers doctor with subcommand placeholder', () => {
    const lines = formatDoctorHelp();
    assert.match(lines[0], /^token-weather doctor \[subcommand\]/);
  });

  it('lists codex and claude subcommands', () => {
    const body = formatDoctorHelp().join('\n');
    assert.match(body, /codex/);
    assert.match(body, /claude/);
  });
});

describe('formatDoctorCodexHelp', () => {
  it('first line targets codex', () => {
    assert.match(formatDoctorCodexHelp()[0], /^token-weather doctor codex/);
  });

  it('lists --refresh-live and --account', () => {
    const body = formatDoctorCodexHelp().join('\n');
    assert.match(body, /--refresh-live/);
    assert.match(body, /--account <id>/);
  });
});

describe('formatDoctorClaudeHelp', () => {
  it('first line targets claude', () => {
    assert.match(formatDoctorClaudeHelp()[0], /^token-weather doctor claude/);
  });

  it('lists --refresh-live and --account', () => {
    const body = formatDoctorClaudeHelp().join('\n');
    assert.match(body, /--refresh-live/);
    assert.match(body, /--account <id>/);
  });
});

describe('formatClaudeSection — multi-account networkUsages', () => {
  const basicSnapshot = {
    credentialsPath: '/x/.credentials.json',
    found: true,
    parsed: true,
    authSource: 'agent-store',
    selectedAccount: { accountKey: 'a:1', authType: 'oauth' },
    usage: { source: 'not-found' },
  };

  it('renders per-account blocks when networkUsages has multiple entries', () => {
    const lines = formatClaudeSection({
      ...basicSnapshot,
      networkUsages: [
        {
          accountKey: 'a:1',
          snapshot: {
            status: { ok: true, httpStatus: 200 },
            usageWindows: [{ kind: 'five_hour', usedPercent: 5, resetAt: '2026-04-16' }],
          },
        },
        {
          accountKey: 'a:2',
          snapshot: {
            status: { ok: false, httpStatus: 401, bucket: 'auth', message: 'expired' },
            usageWindows: [],
          },
        },
      ],
    });
    assert.ok(lines.some((l) => l.includes('- 계정: a:1')));
    assert.ok(lines.some((l) => l.includes('- 계정: a:2')));
    assert.ok(lines.some((l) => l.includes('OK (200)')));
    assert.ok(lines.some((l) => l.includes('실패 (401, bucket=auth)')));
    assert.ok(lines.some((l) => l.includes('메시지: expired')));
  });

  it('omits per-account header when single entry', () => {
    const lines = formatClaudeSection({
      ...basicSnapshot,
      networkUsages: [
        {
          accountKey: 'a:1',
          snapshot: { status: { ok: true, httpStatus: 200 }, usageWindows: [] },
        },
      ],
    });
    assert.ok(!lines.some((l) => l.startsWith('  - 계정:')));
    assert.ok(lines.some((l) => l.includes('OK (200)')));
  });

  it('falls back to legacy networkUsage when networkUsages missing', () => {
    const lines = formatClaudeSection({
      ...basicSnapshot,
      networkUsage: { status: { ok: true, httpStatus: 200 }, usageWindows: [] },
    });
    assert.ok(lines.some((l) => l.includes('OK (200)')));
  });

  it('shows "호출 안 함" when neither networkUsages nor networkUsage', () => {
    const lines = formatClaudeSection({ ...basicSnapshot, networkUsages: [] });
    assert.ok(lines.some((l) => l.includes('호출 안 함')));
  });
});
