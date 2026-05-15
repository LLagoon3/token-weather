import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatStatusForTelegram,
  compactResetTime,
  TELEGRAM_LINE_WIDTH,
} from '../src/telegram-status-formatter.js';

const NOW = new Date('2026-05-15T10:00:00');

function makeMinimalSnapshot(overrides = {}) {
  return {
    schemaVersion: '0.5.0',
    configPath: '/home/u/.config/token-weather/config.json',
    providers: { codex: { enabled: true }, claude: { enabled: true } },
    sync: { enabled: false },
    accountFilter: null,
    providerFilter: null,
    ...overrides,
  };
}

function makeCodexSnapshot(opts = {}) {
  return {
    enabled: true,
    accountFilter: null,
    filteredOut: false,
    usageSnapshots: [
      {
        account: { email: 'me@example.com', plan: 'Pro' },
        status: { ok: true, httpStatus: 200 },
        usageWindows: [
          { kind: 'primary', usedPercent: 38, resetAt: '2026-05-15T21:42:00' },
          { kind: 'secondary', usedPercent: 71, resetAt: '2026-05-16T04:42:00' },
        ],
        ...opts.snapshotOverride,
      },
    ],
    ...opts.codexOverride,
  };
}

function makeClaudeSnapshot(opts = {}) {
  return {
    enabled: true,
    accountFilter: null,
    filteredOut: false,
    usageSnapshots: [
      {
        account: { email: 'me@anthropic.example' },
        status: { ok: true, httpStatus: 200 },
        usageWindows: [
          { kind: 'five_hour', usedPercent: 19, resetAt: '2026-05-15T15:00:00' },
          { kind: 'seven_day', usedPercent: 8, resetAt: '2026-05-22T03:00:00' },
        ],
        ...opts.snapshotOverride,
      },
    ],
    ...opts.claudeOverride,
  };
}

function assertAllLinesWithinWidth(lines, limit = TELEGRAM_LINE_WIDTH) {
  for (const line of lines) {
    assert.ok(
      [...line].length <= limit,
      `line over ${limit}: ${JSON.stringify(line)} (len=${[...line].length})`,
    );
  }
}

describe('formatStatusForTelegram', () => {
  it('top-level summary 는 enabled / disabled flag 만 노출 (config path 미노출 — 모바일 폭 보호)', () => {
    const lines = formatStatusForTelegram(makeMinimalSnapshot(), { now: NOW });
    assert.deepEqual(lines.slice(0, 4), [
      '━━ Status ━━',
      'Codex  enabled',
      'Claude enabled',
      'Sync   disabled',
    ]);
    assertAllLinesWithinWidth(lines);
  });

  it('disabled provider 는 disabled 로 표시', () => {
    const lines = formatStatusForTelegram(
      makeMinimalSnapshot({
        providers: { codex: { enabled: false }, claude: { enabled: false } },
      }),
      { now: NOW },
    );
    assert.ok(lines.includes('Codex  disabled'));
    assert.ok(lines.includes('Claude disabled'));
  });

  it('Codex section — 단일 계정 OK (window 라인에 progress bar)', () => {
    const snapshot = makeMinimalSnapshot({ codex: makeCodexSnapshot() });
    const lines = formatStatusForTelegram(snapshot, { now: NOW });
    assert.ok(lines.includes('━━ Codex ━━'));
    assert.ok(lines.includes('me@example.com · Pro'));
    assert.ok(lines.includes('✓ OK (200)'));
    // issue #146: label padEnd(9) + bar (10) + pct padStart(4)
    assert.ok(lines.some((l) => l.startsWith('· primary   ')));
    assert.ok(lines.some((l) => l.startsWith('· secondary ')));
    // bar 글리프 (full / shade) 가 window 라인에 포함
    assert.ok(lines.some((l) => /^· \w.* [█░▏▎▍▌▋▊▉]{10} +\d+%$/.test(l)));
    assertAllLinesWithinWidth(lines);
  });

  it('Claude section — kind 매핑 (five_hour → 5h, seven_day → 7d) + bar', () => {
    const snapshot = makeMinimalSnapshot({ claude: makeClaudeSnapshot() });
    const lines = formatStatusForTelegram(snapshot, { now: NOW });
    assert.ok(lines.includes('━━ Claude ━━'));
    assert.ok(lines.some((l) => l.startsWith('· 5h        ')));
    assert.ok(lines.some((l) => l.startsWith('· 7d        ')));
    assertAllLinesWithinWidth(lines);
  });

  it('multi-account 일 때 각 계정 블록 사이 빈 줄', () => {
    const snapshot = makeMinimalSnapshot({
      codex: {
        enabled: true,
        accountFilter: null,
        filteredOut: false,
        usageSnapshots: [
          {
            account: { email: 'a@example.com', plan: 'Free' },
            status: { ok: true, httpStatus: 200 },
            usageWindows: [],
          },
          {
            account: { email: 'b@example.com', plan: 'Pro' },
            status: { ok: true, httpStatus: 200 },
            usageWindows: [],
          },
        ],
      },
    });
    const lines = formatStatusForTelegram(snapshot, { now: NOW });
    const aIdx = lines.findIndex((l) => l.includes('a@example.com'));
    const bIdx = lines.findIndex((l) => l.includes('b@example.com'));
    assert.ok(aIdx >= 0 && bIdx > aIdx);
    assert.equal(lines[bIdx - 1], '', '계정 블록 사이 빈 줄 필요');
  });

  it('Codex 비활성화 / 계정 없음 / 필터 미스 분기', () => {
    const disabled = formatStatusForTelegram(
      makeMinimalSnapshot({ codex: { enabled: false, usageSnapshots: [] } }),
      { now: NOW },
    );
    assert.ok(disabled.includes('Disabled'));

    const empty = formatStatusForTelegram(
      makeMinimalSnapshot({ codex: { enabled: true, usageSnapshots: [] } }),
      { now: NOW },
    );
    assert.ok(empty.includes('No Codex profile'));

    const filtered = formatStatusForTelegram(
      makeMinimalSnapshot({
        codex: {
          enabled: true,
          usageSnapshots: [],
          filteredOut: true,
          accountFilter: 'unknown',
        },
      }),
      { now: NOW },
    );
    assert.ok(filtered.some((l) => l.startsWith('No match:')));
  });

  it('Claude 비활성 (snapshot 미존재) 시 섹션 자체 미포함', () => {
    const snapshot = makeMinimalSnapshot({ codex: makeCodexSnapshot() });
    const lines = formatStatusForTelegram(snapshot, { now: NOW });
    assert.ok(!lines.some((l) => l.includes('Claude ━━')));
  });

  it('Claude usageSnapshots 빈 + filteredOut=false → "Skipped" 라벨', () => {
    const snapshot = makeMinimalSnapshot({
      claude: { enabled: true, usageSnapshots: [], filteredOut: false },
    });
    const lines = formatStatusForTelegram(snapshot, { now: NOW });
    assert.ok(lines.includes('Skipped (disabled / no token)'));
  });

  it('FAILED status 는 ✗ + trim 된 에러 메시지', () => {
    const snapshot = makeMinimalSnapshot({
      codex: {
        enabled: true,
        accountFilter: null,
        filteredOut: false,
        usageSnapshots: [
          {
            account: { email: 'fail@example.com' },
            status: { ok: false, message: 'token refresh failed: 401 — {"error":"..."}' },
            usageWindows: [],
          },
        ],
      },
    });
    const lines = formatStatusForTelegram(snapshot, { now: NOW });
    assert.ok(lines.includes('✗ FAILED'));
    assert.ok(lines.some((l) => l.trim().startsWith('token refresh failed: 401')));
    assert.ok(!lines.some((l) => l.includes('{"error"')), '— 이후 raw payload 미포함');
    assertAllLinesWithinWidth(lines);
  });

  it('긴 email 은 truncate — 라인 폭 32 자 이하 보장', () => {
    const snapshot = makeMinimalSnapshot({
      codex: {
        enabled: true,
        usageSnapshots: [
          {
            account: {
              email: 'very-long-test-account-xyz@verylongdomain.example',
              plan: 'Enterprise-Premium-Plus',
            },
            status: { ok: true, httpStatus: 200 },
            usageWindows: [],
          },
        ],
      },
    });
    const lines = formatStatusForTelegram(snapshot, { now: NOW });
    assertAllLinesWithinWidth(lines);
    assert.ok(
      lines.some((l) => l.endsWith('…')),
      '긴 헤더가 truncate 표시(…)로 끝남',
    );
  });

  it('window 의 usedPercent 가 null → bar 전체 ░ + pct "—"', () => {
    const snapshot = makeMinimalSnapshot({
      claude: {
        enabled: true,
        usageSnapshots: [
          {
            account: { email: 'me@example.com' },
            status: { ok: true, httpStatus: 200 },
            usageWindows: [{ kind: 'five_hour', usedPercent: null, resetAt: null }],
          },
        ],
      },
    });
    const lines = formatStatusForTelegram(snapshot, { now: NOW });
    // '· 5h        ░░░░░░░░░░    —' (label padEnd(9) + space + 10× ░ + space + '   —')
    assert.ok(lines.some((l) => l.startsWith('· 5h        ░░░░░░░░░░')));
    assert.ok(lines.some((l) => l.endsWith('—')));
    assert.ok(lines.some((l) => l.startsWith('  reset unknown')));
  });

  it('accountFilter / providerFilter 가 있으면 noise 없이 한 줄씩 추가', () => {
    const snapshot = makeMinimalSnapshot({
      accountFilter: 'mylabel',
      providerFilter: 'codex',
    });
    const lines = formatStatusForTelegram(snapshot, { now: NOW });
    assert.ok(lines.some((l) => l.startsWith('Acct filter:')));
    assert.ok(lines.some((l) => l.startsWith('Prov filter: codex')));
  });

  it('박스 글리프 (╭ │ ╰ ┌ └ ─) 미사용 — issue #144 회귀 가드 (bar 글리프는 #146 으로 의도)', () => {
    const snapshot = makeMinimalSnapshot({
      codex: makeCodexSnapshot(),
      claude: makeClaudeSnapshot(),
    });
    const lines = formatStatusForTelegram(snapshot, { now: NOW });
    const joined = lines.join('\n');
    for (const glyph of ['╭', '│', '╰', '┌', '└', '─']) {
      assert.ok(!joined.includes(glyph), `glyph 미포함 기대: ${glyph}`);
    }
  });

  it('issue #146: 모든 window 라인에 bar 글리프가 등장 (full block 또는 shade)', () => {
    const snapshot = makeMinimalSnapshot({
      codex: makeCodexSnapshot(),
      claude: makeClaudeSnapshot(),
    });
    const lines = formatStatusForTelegram(snapshot, { now: NOW });
    const windowLines = lines.filter((l) => l.startsWith('· '));
    assert.ok(windowLines.length > 0, 'window 라인이 존재');
    for (const l of windowLines) {
      assert.ok(/[█░▏▎▍▌▋▊▉]/.test(l), `window 라인에 bar 글리프 기대: ${JSON.stringify(l)}`);
    }
  });
});

describe('compactResetTime', () => {
  it('null / 잘못된 입력 처리', () => {
    assert.equal(compactResetTime(null, NOW), 'unknown');
    assert.equal(compactResetTime(undefined, NOW), 'unknown');
    assert.equal(compactResetTime('not-a-date', NOW), 'not-a-date');
  });

  it('같은 day → 시간만 (timezone 미포함)', () => {
    const same = new Date('2026-05-15T21:42:00');
    assert.equal(compactResetTime(same, NOW), '9:42pm');
    const onTheHour = new Date('2026-05-15T15:00:00');
    assert.equal(compactResetTime(onTheHour, NOW), '3pm');
  });

  it('7일 이내 다른 day → weekday + 시간', () => {
    const tomorrow = new Date('2026-05-16T04:42:00');
    const result = compactResetTime(tomorrow, NOW);
    assert.match(result, /^Sat 4:42am$/);
  });

  it('7일 이후 → month day + 시간', () => {
    const later = new Date('2026-06-10T09:00:00');
    const result = compactResetTime(later, NOW);
    assert.match(result, /^Jun 10 9am$/);
  });

  it('어떤 입력이어도 반환값에 괄호 timezone 없음 (모바일 폭 보호)', () => {
    const cases = [
      new Date('2026-05-15T21:42:00'),
      new Date('2026-05-16T04:42:00'),
      new Date('2026-06-10T09:00:00'),
    ];
    for (const c of cases) {
      assert.ok(!compactResetTime(c, NOW).includes('('));
    }
  });
});
