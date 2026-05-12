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
  // v0.5.0 (issue #120): doctor 의 formatClaudeSection 도 새 contract 정합 —
  // detected/found/selectedAccount alias 제거 + enabled / usageSnapshots 사용.
  const FAKE_PATH = '/home/user/.claude/.credentials.json';

  it('includes credentialsPath in output', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      enabled: true,
      authSource: 'claude-cli-import',
      usageSnapshots: [],
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes(FAKE_PATH)));
  });

  it('shows authSource and enabled when credentials exist', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      enabled: true,
      authSource: 'claude-cli-import',
      usageSnapshots: [],
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('authSource') && l.includes('claude-cli-import')));
    assert.ok(lines.some((l) => l.includes('enabled') && l.includes('true')));
    // 제거된 alias 출력 부재 회귀 가드 (Phase 1+2)
    assert.equal(
      lines.some((l) => l.includes('parsed') || l.includes('found:') || l.includes('accountKey')),
      false,
    );
  });

  it('shows enabled=false when claude disabled', () => {
    const snapshot = {
      credentialsPath: null,
      enabled: false,
      authSource: 'not-found',
      usageSnapshots: [],
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('enabled') && l.includes('false')));
  });

  it('returns an array with at least 4 lines', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      enabled: true,
      authSource: 'claude-cli-import',
      usageSnapshots: [],
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.length >= 4);
  });

  it('shows live usage OK with usageWindows for a successful entry', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      enabled: true,
      authSource: 'claude-cli-import',
      usageSnapshots: [
        {
          account: { profileId: 'claude-cli-import' },
          status: { ok: true, httpStatus: 200 },
          usageWindows: [
            { kind: 'five_hour', usedPercent: 25, resetAt: '2026-04-14T14:00:00.000Z' },
            { kind: 'seven_day', usedPercent: 80, resetAt: null },
          ],
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
      enabled: true,
      authSource: 'claude-cli-import',
      usageSnapshots: [
        {
          account: { profileId: 'claude-cli-import' },
          status: {
            ok: false,
            httpStatus: 403,
            bucket: 'auth_scope',
            message: 'missing scope requirement user:profile',
          },
          usageWindows: [],
        },
      ],
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(
      lines.some((l) => l.includes('실패') && l.includes('403') && l.includes('auth_scope')),
    );
    assert.ok(lines.some((l) => l.includes('user:profile')));
  });

  it('shows "호출 안 함" when usageSnapshots is empty', () => {
    const snapshot = {
      credentialsPath: null,
      enabled: false,
      authSource: 'not-found',
      usageSnapshots: [],
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

describe('formatClaudeSection — multi-account usageSnapshots', () => {
  const basicSnapshot = {
    credentialsPath: '/x/.credentials.json',
    enabled: true,
    authSource: 'agent-store',
  };

  it('renders per-account blocks when usageSnapshots has multiple entries', () => {
    const lines = formatClaudeSection({
      ...basicSnapshot,
      usageSnapshots: [
        {
          account: { profileId: 'a:1' },
          status: { ok: true, httpStatus: 200 },
          usageWindows: [{ kind: 'five_hour', usedPercent: 5, resetAt: '2026-04-16' }],
        },
        {
          account: { profileId: 'a:2' },
          status: { ok: false, httpStatus: 401, bucket: 'auth', message: 'expired' },
          usageWindows: [],
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
      usageSnapshots: [
        {
          account: { profileId: 'a:1' },
          status: { ok: true, httpStatus: 200 },
          usageWindows: [],
        },
      ],
    });
    assert.ok(!lines.some((l) => l.startsWith('  - 계정:')));
    assert.ok(lines.some((l) => l.includes('OK (200)')));
  });

  it('shows "호출 안 함" when usageSnapshots is empty', () => {
    const lines = formatClaudeSection({ ...basicSnapshot, usageSnapshots: [] });
    assert.ok(lines.some((l) => l.includes('호출 안 함')));
  });
});
