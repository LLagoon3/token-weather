import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatStatusOutput,
  formatCodexSection,
  formatClaudeSection,
  formatClaudeNetworkUsage,
  formatClaudeNetworkUsages,
  formatClaudeLocalUsage,
  formatWindow,
  parseStatusOptions,
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

  it('shows Auth profiles 경로 when openclaw-import', () => {
    const lines = formatCodexSection({
      enabled: true,
      authSource: 'openclaw-import',
      authProfilesPath: '/path/openclaw.json',
      snapshots: [],
    });
    assert.ok(lines.some((l) => l.includes('Auth profiles 경로: /path/openclaw.json')));
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

describe('formatClaudeLocalUsage', () => {
  it('shows 데이터 없음 when usage is null or not-found', () => {
    assert.ok(formatClaudeLocalUsage(null).some((l) => l.includes('데이터 없음')));
    assert.ok(formatClaudeLocalUsage({ source: 'not-found' }).some((l) => l.includes('데이터 없음')));
  });

  it('renders totalSessions / totalMessages / model usage indicators', () => {
    const lines = formatClaudeLocalUsage({
      source: 'stats-cache-json',
      totalSessions: 10,
      totalMessages: 200,
      hasModelUsage: true,
      hasDailyModelTokens: false,
    });
    assert.ok(lines.some((l) => l.includes('총 세션 수: 10')));
    assert.ok(lines.some((l) => l.includes('총 메시지 수: 200')));
    assert.ok(lines.some((l) => l.includes('모델별 usage: 있음')));
    assert.ok(lines.some((l) => l.includes('일별 token 통계: 없음')));
  });
});

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
        usage: { source: 'not-found' },
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
      usage: { source: 'not-found' },
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
      usage: { source: 'not-found' },
    });
    assert.ok(lines.some((l) => l.includes('OK (200)')));
    // 단일 블록이므로 '- 계정:' 헤더 없어야 함
    assert.ok(!lines.some((l) => l.startsWith('  - 계정:')));
  });
});

describe('parseStatusOptions', () => {
  it('returns { account: null } for empty args', () => {
    assert.deepEqual(parseStatusOptions([]), { account: null });
  });

  it('handles null/undefined args', () => {
    assert.deepEqual(parseStatusOptions(undefined), { account: null });
  });

  it('parses --account <value>', () => {
    assert.equal(parseStatusOptions(['--account', 'alice@x.com']).account, 'alice@x.com');
    assert.equal(parseStatusOptions(['--account', 'codex:abc']).account, 'codex:abc');
  });

  it('ignores unknown flags', () => {
    const out = parseStatusOptions(['--unknown', '--account', 'a']);
    assert.equal(out.account, 'a');
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
        usage: { source: 'not-found' },
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
        usage: { source: 'not-found' },
      },
    });
    assert.ok(lines.includes('계정 필터: alice@x.com'));
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
    assert.ok(lines.some((l) => l.includes('계정 필터 "nope@x.com"에 해당하는 Codex 계정을 찾지 못했습니다')));
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
    assert.ok(lines.some((l) => l.includes('계정 필터 "nope"에 해당하는 Claude 계정을 찾지 못했습니다')));
  });
});
