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
      authSource: 'claude-cli-import',
      selectedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes(FAKE_PATH)));
  });

  it('shows found=true and authSource when credentials exist (issue #119: parsed alias 제거)', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      authSource: 'claude-cli-import',
      selectedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('found') && l.includes('true')));
    assert.ok(lines.some((l) => l.includes('authSource') && l.includes('claude-cli-import')));
    // parsed alias 출력 부재 회귀 가드
    assert.equal(
      lines.some((l) => l.includes('parsed')),
      false,
    );
  });

  it('shows found=false when credentials are absent', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: false,
      authSource: 'claude-cli-import',
      selectedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('found') && l.includes('false')));
    assert.equal(
      lines.some((l) => l.includes('parsed')),
      false,
    );
  });

  it('returns an array with at least 4 lines', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: false,
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
      authSource: 'claude-cli-import',
      selectedAccount: { accountKey: 'claude-cli-import' },
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('authType') && l.includes('알 수 없음')));
  });

  // issue #110 — formatClaudeSection 의 stats-cache 출력 블록은 v0.3.0 에서 제거됨.
  // (이전 두 테스트 `shows usage stats when usage source is stats-cache-json` 와
  // `shows not-found message when usage source is not-found` 는 stats-cache 의존
  // 제거에 따라 같이 삭제.)

  it('shows live usage OK with usageWindows for a successful entry (issue #119: networkUsages[] only)', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      authSource: 'claude-cli-import',
      selectedAccount: null,
      networkUsages: [
        {
          accountKey: 'claude-cli-import',
          snapshot: {
            status: { ok: true, httpStatus: 200 },
            usageWindows: [
              { kind: 'five_hour', usedPercent: 25, resetAt: '2026-04-14T14:00:00.000Z' },
              { kind: 'seven_day', usedPercent: 80, resetAt: null },
            ],
          },
        },
      ],
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('Claude live usage')));
    assert.ok(lines.some((l) => l.includes('OK (200)')));
    assert.ok(lines.some((l) => l.includes('five_hour') && l.includes('25%')));
    assert.ok(lines.some((l) => l.includes('seven_day') && l.includes('80%')));
  });

  it('shows live usage failure bucket and message for a failed entry', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      authSource: 'claude-cli-import',
      selectedAccount: null,
      networkUsages: [
        {
          accountKey: 'claude-cli-import',
          snapshot: {
            status: {
              ok: false,
              httpStatus: 403,
              bucket: 'auth_scope',
              message: 'missing scope requirement user:profile',
            },
            usageWindows: [],
          },
        },
      ],
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(
      lines.some((l) => l.includes('실패') && l.includes('403') && l.includes('auth_scope')),
    );
    assert.ok(lines.some((l) => l.includes('user:profile')));
  });

  it('shows "호출 안 함" when networkUsages is empty', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: false,
      authSource: 'not-found',
      selectedAccount: null,
      networkUsages: [],
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
    assert.deepEqual(parseDoctorClaudeOptions(['--dedupe', '--apply', '--backfill-account-id']), {
      ...DEFAULTS,
      dedupe: true,
      apply: true,
      backfillAccountId: true,
    });
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

  // issue #119: legacy `networkUsage` (단일) fallback 은 제거됨 — `networkUsages[]` 만 지원.

  it('shows "호출 안 함" when networkUsages is empty', () => {
    const lines = formatClaudeSection({ ...basicSnapshot, networkUsages: [] });
    assert.ok(lines.some((l) => l.includes('호출 안 함')));
  });
});
