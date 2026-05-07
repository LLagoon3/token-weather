import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatStatusOutput,
  formatCodexSection,
  formatClaudeSection,
  formatClaudeNetworkUsage,
  formatClaudeNetworkUsages,
  formatWindow,
  formatStatusHelp,
  parseStatusOptions,
  normalizeProviderFilter,
  STATUS_COMMANDS,
} from '../../src/cli/status-command.js';

describe('STATUS_COMMANDS', () => {
  it('exposes status and usage as entry points', () => {
    assert.deepEqual([...STATUS_COMMANDS].sort(), ['status', 'usage']);
  });
});

describe('formatWindow', () => {
  it('renders used_percent and reset_at when present', () => {
    assert.equal(
      formatWindow({ usedPercent: 25, resetAt: '2026-04-15T00:00:00Z' }),
      'used_percent=25, reset_at=2026-04-15T00:00:00Z',
    );
  });

  it('falls back to unknown when fields missing', () => {
    assert.equal(
      formatWindow({ usedPercent: null, resetAt: null }),
      'used_percent=unknown, reset_at=unknown',
    );
  });
});

describe('formatCodexSection', () => {
  it('shows 비활성화됨 when codex is disabled', () => {
    const lines = formatCodexSection({ enabled: false });
    assert.ok(lines.includes('비활성화됨'));
  });

  it('reports no profile message when enabled but snapshots empty', () => {
    const lines = formatCodexSection({ enabled: true, authSource: 'agent-store', snapshots: [] });
    assert.ok(lines.some((l) => l.includes('인증 소스: agent-store')));
    assert.ok(lines.some((l) => l.includes('Codex OAuth 프로필이 없습니다')));
  });

  it('shows Codex CLI credential 경로 when codex-cli-import (issue #113)', () => {
    const lines = formatCodexSection({
      enabled: true,
      authSource: 'codex-cli-import',
      credentialsPath: '/home/u/.codex/auth.json',
      snapshots: [],
    });
    assert.ok(
      lines.some((l) => l.includes('Codex CLI credential 경로: /home/u/.codex/auth.json')),
    );
  });

  it('renders snapshot details + windows + plan + error', () => {
    const lines = formatCodexSection({
      enabled: true,
      authSource: 'agent-store',
      snapshots: [
        {
          source: 'provider_usage_endpoint',
          authType: 'oauth',
          confidence: 'high',
          account: { profileId: 'p1', email: 'x@example.com', plan: 'plus' },
          status: { ok: true, httpStatus: 200, message: null },
          usageWindows: [{ kind: 'primary', usedPercent: 5, resetAt: '2026-04-15' }],
        },
      ],
    });
    assert.ok(lines.some((l) => l.includes('p1 (x@example.com)')));
    assert.ok(lines.some((l) => l.includes('상태: OK (200)')));
    assert.ok(lines.some((l) => l.includes('confidence=high')));
    assert.ok(lines.some((l) => l.includes('플랜: plus')));
    assert.ok(lines.some((l) => l.includes('primary: used_percent=5')));
  });

  it('renders failure status with httpStatus/network and includes error message', () => {
    const lines = formatCodexSection({
      enabled: true,
      authSource: 'agent-store',
      snapshots: [
        {
          source: 'provider_usage_endpoint',
          authType: 'oauth',
          confidence: 'low',
          account: { profileId: 'p1' },
          status: { ok: false, httpStatus: 500, message: 'boom' },
          usageWindows: [],
        },
      ],
    });
    assert.ok(lines.some((l) => l.includes('실패 (500)')));
    assert.ok(lines.some((l) => l.includes('에러: boom')));
  });

  it('uses network/error label when httpStatus is null', () => {
    const lines = formatCodexSection({
      enabled: true,
      authSource: 'agent-store',
      snapshots: [
        {
          source: 'x',
          authType: 'oauth',
          confidence: 'low',
          account: { profileId: 'p1' },
          status: { ok: false, httpStatus: null },
          usageWindows: [],
        },
      ],
    });
    assert.ok(lines.some((l) => l.includes('실패 (network/error)')));
  });
});

describe('formatClaudeNetworkUsage', () => {
  it('shows 호출 안 함 when networkUsage is null', () => {
    assert.ok(formatClaudeNetworkUsage(null).some((l) => l.includes('호출 안 함')));
  });

  it('renders OK + windows on success', () => {
    const lines = formatClaudeNetworkUsage({
      status: { ok: true, httpStatus: 200 },
      usageWindows: [{ kind: 'five_hour', usedPercent: 10, resetAt: '2026-04-15' }],
    });
    assert.ok(lines.some((l) => l.includes('상태: OK (200)')));
    assert.ok(lines.some((l) => l.includes('five_hour: used_percent=10')));
  });

  it('reports usageWindows 없음 when ok=true with empty windows', () => {
    const lines = formatClaudeNetworkUsage({
      status: { ok: true, httpStatus: 200 },
      usageWindows: [],
    });
    assert.ok(lines.some((l) => l.includes('usageWindows 없음')));
  });

  it('shows failure with bucket and message', () => {
    const lines = formatClaudeNetworkUsage({
      status: { ok: false, httpStatus: 403, bucket: 'auth_scope', message: 'missing scope' },
      usageWindows: [],
    });
    assert.ok(lines.some((l) => l.includes('실패 (403, bucket=auth_scope)')));
    assert.ok(lines.some((l) => l.includes('메시지: missing scope')));
  });
});

// issue #110 — formatClaudeLocalUsage / [local] stats-cache.json 블록은
// v0.3.0 에서 제거됐다. 이전 두 테스트 (`shows 데이터 없음 ...`, `renders
// totalSessions / totalMessages / model usage indicators`) 는 함수 자체가
// 사라져 적용 안 됨.

describe('formatStatusOutput', () => {
  it('contains the command name and config summary lines', () => {
    const lines = formatStatusOutput('status', {
      configPath: '/x/config.json',
      providers: { codex: { enabled: true }, claude: { enabled: false } },
      sync: { enabled: false },
      codex: { enabled: false },
      claude: {
        authSource: 'not-found',
        detected: false,
        selectedAccount: null,
        networkUsage: null,
      },
    });
    assert.ok(lines.includes('명령: status'));
    assert.ok(lines.includes('설정 파일: /x/config.json'));
    assert.ok(lines.includes('Codex 사용: enabled'));
    assert.ok(lines.includes('Claude 사용: disabled'));
  });
});

describe('formatClaudeNetworkUsages — multi-account', () => {
  it('renders single "호출 안 함" line when usages is empty', () => {
    const lines = formatClaudeNetworkUsages([]);
    assert.ok(lines.some((l) => l.includes('호출 안 함')));
  });

  it('outputs a single block without account header when usages has one entry', () => {
    const lines = formatClaudeNetworkUsages([
      {
        accountKey: 'a:1',
        snapshot: {
          status: { ok: true, httpStatus: 200 },
          usageWindows: [{ kind: 'five_hour', usedPercent: 10, resetAt: '2026-04-16' }],
        },
      },
    ]);
    // 단일 계정 블록은 '계정:' 헤더를 붙이지 않음
    assert.ok(!lines.some((l) => l.startsWith('  - 계정:')));
    assert.ok(lines.some((l) => l.includes('OK (200)')));
  });

  it('outputs per-account header + body for multiple usages', () => {
    const lines = formatClaudeNetworkUsages([
      {
        accountKey: 'a:1',
        snapshot: {
          status: { ok: true, httpStatus: 200 },
          usageWindows: [{ kind: 'five_hour', usedPercent: 5 }],
        },
      },
      {
        accountKey: 'a:2',
        snapshot: {
          status: { ok: false, httpStatus: 401, bucket: 'auth', message: 'expired' },
          usageWindows: [],
        },
      },
    ]);
    assert.ok(lines.some((l) => l.includes('- 계정: a:1')));
    assert.ok(lines.some((l) => l.includes('- 계정: a:2')));
    assert.ok(lines.some((l) => l.includes('OK (200)')));
    assert.ok(lines.some((l) => l.includes('실패 (401, bucket=auth)')));
    assert.ok(lines.some((l) => l.includes('메시지: expired')));
  });
});

describe('formatClaudeSection — networkUsages array support', () => {
  it('uses networkUsages when provided (multi-account path)', () => {
    const lines = formatClaudeSection({
      authSource: 'agent-store',
      detected: true,
      selectedAccount: { accountKey: 'a:1' },
      networkUsages: [
        {
          accountKey: 'a:1',
          snapshot: { status: { ok: true, httpStatus: 200 }, usageWindows: [] },
        },
        {
          accountKey: 'a:2',
          snapshot: { status: { ok: true, httpStatus: 200 }, usageWindows: [] },
        },
      ],
    });
    assert.ok(lines.some((l) => l.includes('- 계정: a:1')));
    assert.ok(lines.some((l) => l.includes('- 계정: a:2')));
  });

  it('falls back to legacy networkUsage when networkUsages absent', () => {
    const lines = formatClaudeSection({
      authSource: 'claude-cli-import',
      detected: true,
      selectedAccount: null,
      networkUsage: { status: { ok: true, httpStatus: 200 }, usageWindows: [] },
    });
    assert.ok(lines.some((l) => l.includes('OK (200)')));
    // 단일 블록이므로 '- 계정:' 헤더 없어야 함
    assert.ok(!lines.some((l) => l.startsWith('  - 계정:')));
  });
});

describe('parseStatusOptions', () => {
  it('returns { account: null } for empty args', () => {
    assert.deepEqual(parseStatusOptions([]), {
      account: null,
      provider: null,
      json: false,
      help: false,
    });
  });

  it('handles null/undefined args', () => {
    assert.deepEqual(parseStatusOptions(undefined), {
      account: null,
      provider: null,
      json: false,
      help: false,
    });
  });

  it('parses --account <value>', () => {
    assert.equal(parseStatusOptions(['--account', 'alice@x.com']).account, 'alice@x.com');
    assert.equal(parseStatusOptions(['--account', 'codex:abc']).account, 'codex:abc');
  });

  it('ignores unknown flags', () => {
    const out = parseStatusOptions(['--unknown', '--account', 'a']);
    assert.equal(out.account, 'a');
  });

  it('treats --account "" as "no value" (legacy contract)', () => {
    // 공통 helper 전환 후에도 빈 문자열은 default 유지해야 한다.
    assert.deepEqual(parseStatusOptions(['--account', '']), {
      account: null,
      provider: null,
      json: false,
      help: false,
    });
  });

  it('recognizes --help and -h', () => {
    assert.equal(parseStatusOptions(['--help']).help, true);
    assert.equal(parseStatusOptions(['-h']).help, true);
    assert.equal(parseStatusOptions([]).help, false);
  });

  it('parses --provider <id>', () => {
    assert.equal(parseStatusOptions(['--provider', 'codex']).provider, 'codex');
    assert.equal(parseStatusOptions(['--provider', 'claude']).provider, 'claude');
  });

  it('--provider and --account can coexist', () => {
    const out = parseStatusOptions(['--provider', 'codex', '--account', 'work']);
    assert.equal(out.provider, 'codex');
    assert.equal(out.account, 'work');
  });

  it('parses --json as boolean true', () => {
    assert.equal(parseStatusOptions(['--json']).json, true);
    assert.equal(parseStatusOptions([]).json, false);
  });

  it('--json combines with --provider / --account', () => {
    const out = parseStatusOptions(['--json', '--provider', 'codex', '--account', 'work']);
    assert.equal(out.json, true);
    assert.equal(out.provider, 'codex');
    assert.equal(out.account, 'work');
  });
});

describe('normalizeProviderFilter', () => {
  it('returns null for null/undefined/empty input', () => {
    assert.equal(normalizeProviderFilter(null), null);
    assert.equal(normalizeProviderFilter(undefined), null);
    assert.equal(normalizeProviderFilter(''), null);
    assert.equal(normalizeProviderFilter('   '), null);
  });

  it('passes registered ids through unchanged', () => {
    assert.equal(normalizeProviderFilter('codex'), 'codex');
    assert.equal(normalizeProviderFilter('claude'), 'claude');
  });

  it('matches case-insensitively (Codex / CLAUDE / cLaUdE)', () => {
    assert.equal(normalizeProviderFilter('Codex'), 'codex');
    assert.equal(normalizeProviderFilter('CLAUDE'), 'claude');
    assert.equal(normalizeProviderFilter('cLaUdE'), 'claude');
  });

  it('trims whitespace before lookup', () => {
    assert.equal(normalizeProviderFilter('  codex  '), 'codex');
    assert.equal(normalizeProviderFilter('\tclaude\n'), 'claude');
  });

  it('returns null when normalized value is not a registered id', () => {
    assert.equal(normalizeProviderFilter('gemini'), null);
    // accountKey-prefix 변형은 의도적으로 받지 않는다 (별도 결정 사안).
    assert.equal(normalizeProviderFilter('openai-codex'), null);
    assert.equal(normalizeProviderFilter('anthropic-claude'), null);
  });
});

describe('formatStatusHelp', () => {
  it('returns first line with command name and [options]', () => {
    const lines = formatStatusHelp('status');
    assert.match(lines[0], /^token-weather status \[options\]$/);
  });

  it('defaults command to "status" when not provided', () => {
    const lines = formatStatusHelp();
    assert.match(lines[0], /token-weather status/);
  });

  it('lists --account, --provider, --json and --help in Options section', () => {
    const body = formatStatusHelp('usage').join('\n');
    assert.match(body, /--account/);
    assert.match(body, /--provider <id>/);
    assert.match(body, /--json/);
    assert.match(body, /-h, --help/);
  });

  it('shows registered provider ids in --provider hint', () => {
    const body = formatStatusHelp().join('\n');
    assert.match(body, /codex/);
    assert.match(body, /claude/);
  });

  it('mentions case-insensitive matching for --provider', () => {
    assert.match(formatStatusHelp().join('\n'), /case-insensitive/);
  });
});

describe('formatStatusOutput — accountFilter line', () => {
  it('omits 계정 필터 line when not set', () => {
    const lines = formatStatusOutput('status', {
      configPath: '/x',
      providers: { codex: { enabled: true }, claude: { enabled: true } },
      sync: { enabled: false },
      codex: { enabled: false },
      claude: {
        authSource: 'not-found',
        detected: false,
        selectedAccount: null,
        networkUsages: [],
      },
    });
    assert.ok(!lines.some((l) => l.includes('계정 필터')));
  });

  it('includes 계정 필터 line when accountFilter present', () => {
    const lines = formatStatusOutput('status', {
      configPath: '/x',
      providers: { codex: { enabled: true }, claude: { enabled: true } },
      sync: { enabled: false },
      accountFilter: 'alice@x.com',
      codex: { enabled: false },
      claude: {
        authSource: 'not-found',
        detected: false,
        selectedAccount: null,
        networkUsages: [],
      },
    });
    assert.ok(lines.includes('계정 필터: alice@x.com'));
  });
});

describe('formatStatusOutput — providerFilter scope', () => {
  const baseSnapshot = {
    configPath: '/x',
    providers: { codex: { enabled: true }, claude: { enabled: true } },
    sync: { enabled: false },
  };
  const codexSnap = { enabled: false };
  const claudeSnap = {
    authSource: 'not-found',
    detected: false,
    selectedAccount: null,
    networkUsages: [],
  };

  it('renders only Codex usage section when providerFilter=codex (no claude key)', () => {
    const lines = formatStatusOutput('status', {
      ...baseSnapshot,
      providerFilter: 'codex',
      codex: codexSnap,
    });
    assert.ok(lines.includes('provider 필터: codex'));
    assert.ok(lines.some((l) => l === 'Codex usage'));
    assert.ok(!lines.some((l) => l === 'Claude usage'));
  });

  it('renders only Claude usage section when providerFilter=claude (no codex key)', () => {
    const lines = formatStatusOutput('usage', {
      ...baseSnapshot,
      providerFilter: 'claude',
      claude: claudeSnap,
    });
    assert.ok(lines.includes('provider 필터: claude'));
    assert.ok(lines.some((l) => l === 'Claude usage'));
    assert.ok(!lines.some((l) => l === 'Codex usage'));
  });

  it('omits "provider 필터" line when not set', () => {
    const lines = formatStatusOutput('status', {
      ...baseSnapshot,
      codex: codexSnap,
      claude: claudeSnap,
    });
    assert.ok(!lines.some((l) => l.startsWith('provider 필터:')));
  });
});

describe('formatCodexSection — accountFilter empty result', () => {
  it('shows filter-specific message when filteredOut=true and snapshots empty', () => {
    const lines = formatCodexSection({
      enabled: true,
      authSource: 'agent-store',
      accountFilter: 'nope@x.com',
      filteredOut: true,
      snapshots: [],
    });
    assert.ok(
      lines.some((l) =>
        l.includes('계정 필터 "nope@x.com"에 해당하는 Codex 계정을 찾지 못했습니다'),
      ),
    );
  });

  it('falls back to normal "프로필 없음" when filteredOut=false', () => {
    const lines = formatCodexSection({
      enabled: true,
      authSource: 'agent-store',
      snapshots: [],
    });
    assert.ok(lines.some((l) => l.includes('Codex OAuth 프로필이 없습니다')));
  });
});

describe('formatClaudeNetworkUsages — filteredOut context', () => {
  it('shows filter-specific message when context.filteredOut is set', () => {
    const lines = formatClaudeNetworkUsages([], { filteredOut: true, accountFilter: 'nope' });
    assert.ok(
      lines.some((l) => l.includes('계정 필터 "nope"에 해당하는 Claude 계정을 찾지 못했습니다')),
    );
  });
});

describe('formatClaudeSection — 기본 계정 라인 visibility', () => {
  const baseClaude = {
    authSource: 'agent-store',
    detected: true,
    selectedAccount: { accountKey: 'a:default' },
    networkUsages: [
      {
        accountKey: 'a:default',
        snapshot: { status: { ok: true, httpStatus: 200 }, usageWindows: [] },
      },
    ],
  };

  it('shows "기본 계정" line when accountFilter is not set', () => {
    const lines = formatClaudeSection(baseClaude);
    assert.ok(lines.some((l) => l.startsWith('기본 계정: a:default')));
  });

  it('hides "기본 계정" line when accountFilter is active (avoid confusion with filtered set)', () => {
    const lines = formatClaudeSection({
      ...baseClaude,
      accountFilter: 'work',
      networkUsages: [
        {
          accountKey: 'a:work',
          snapshot: { status: { ok: true, httpStatus: 200 }, usageWindows: [] },
        },
      ],
    });
    assert.ok(!lines.some((l) => l.startsWith('기본 계정:')));
    assert.ok(lines.some((l) => l.includes('OK (200)')));
  });
});
