import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatStatusOutput,
  formatCodexSection,
  formatClaudeSection,
  formatClaudeNetworkUsage,
  formatClaudeNetworkUsages,
  formatWindowBlock,
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

describe('formatWindowBlock (issue #116 — claude-style multi-line block)', () => {
  it('returns 3 lines: label / bar+pct / Resets', () => {
    const block = formatWindowBlock({
      kind: 'primary',
      usedPercent: 25,
      resetAt: '2026-04-15T00:00:00Z',
    });
    assert.equal(block.length, 3);
    assert.equal(block[0], 'Primary window');
    assert.match(block[1], / 25% used$/);
    assert.match(block[2], /^Resets /);
  });

  it('bar line includes filled blocks for non-zero percent', () => {
    const block = formatWindowBlock({ kind: 'primary', usedPercent: 25, resetAt: null });
    assert.ok(block[1].includes('█'));
  });

  it('null usedPercent → " --% used" (no bar fill, no level color)', () => {
    const block = formatWindowBlock({
      kind: 'primary',
      usedPercent: null,
      resetAt: null,
    });
    assert.match(block[1], / --% used$/);
    assert.ok(!block[1].includes('█'));
    // Resets line falls back to 'unknown'
    assert.equal(block[2], 'Resets unknown');
  });

  it('omits ANSI escape sequences when useColor is false (default)', () => {
    const block = formatWindowBlock({ kind: 'primary', usedPercent: 95, resetAt: '2026-04-15' });
    assert.ok(!block[1].includes('\x1b['));
  });

  it('emits ANSI escape sequences when useColor=true', () => {
    const block = formatWindowBlock(
      { kind: 'primary', usedPercent: 95, resetAt: '2026-04-15' },
      { useColor: true },
    );
    assert.ok(block[1].includes('\x1b['));
  });

  it('uses friendly label mapping for known kinds', () => {
    assert.equal(
      formatWindowBlock({ kind: 'five_hour', usedPercent: 5 })[0],
      'Current session (5h)',
    );
    assert.equal(
      formatWindowBlock({ kind: 'seven_day_sonnet', usedPercent: 5 })[0],
      'Current week (Sonnet only)',
    );
  });
});

describe('formatCodexSection', () => {
  it('shows Disabled when codex is disabled', () => {
    const lines = formatCodexSection({ enabled: false });
    assert.ok(lines.includes('Disabled'));
  });

  it('reports no profile message when enabled but snapshots empty', () => {
    const lines = formatCodexSection({ enabled: true, authSource: 'agent-store', snapshots: [] });
    assert.ok(lines.some((l) => l.includes('Auth source: agent-store')));
    assert.ok(lines.some((l) => l.includes('No Codex OAuth profile found')));
  });

  it('shows Codex CLI credential path when codex-cli-import (issue #113)', () => {
    const lines = formatCodexSection({
      enabled: true,
      authSource: 'codex-cli-import',
      credentialsPath: '/home/u/.codex/auth.json',
      snapshots: [],
    });
    assert.ok(lines.some((l) => l.includes('Codex CLI credential path: /home/u/.codex/auth.json')));
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
    assert.ok(lines.some((l) => l.includes('Status: OK (200)')));
    assert.ok(lines.some((l) => l.includes('confidence=high')));
    assert.ok(lines.some((l) => l.includes('Plan: plus')));
    // window block (3 lines): friendly label / bar+pct / Resets
    assert.ok(lines.some((l) => l.trimStart() === 'Primary window'));
    assert.ok(lines.some((l) => / 5% used$/.test(l)));
    assert.ok(lines.some((l) => /^ +Resets /.test(l)));
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
    assert.ok(lines.some((l) => l.includes('FAILED (500)')));
    assert.ok(lines.some((l) => l.includes('Error: boom')));
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
    assert.ok(lines.some((l) => l.includes('FAILED (network/error)')));
  });
});

describe('formatClaudeNetworkUsage', () => {
  it('shows Skipped when networkUsage is null', () => {
    assert.ok(formatClaudeNetworkUsage(null).some((l) => l.includes('Skipped')));
  });

  it('renders OK + windows on success', () => {
    const lines = formatClaudeNetworkUsage({
      status: { ok: true, httpStatus: 200 },
      usageWindows: [{ kind: 'five_hour', usedPercent: 10, resetAt: '2026-04-15' }],
    });
    assert.ok(lines.some((l) => l.includes('Status: OK (200)')));
    // five_hour → friendly label + bar+pct + Resets
    assert.ok(lines.some((l) => l.trimStart() === 'Current session (5h)'));
    assert.ok(lines.some((l) => / 10% used$/.test(l)));
  });

  it('reports "No usageWindows" when ok=true with empty windows', () => {
    const lines = formatClaudeNetworkUsage({
      status: { ok: true, httpStatus: 200 },
      usageWindows: [],
    });
    assert.ok(lines.some((l) => l.includes('No usageWindows')));
  });

  it('shows failure with bucket and message', () => {
    const lines = formatClaudeNetworkUsage({
      status: { ok: false, httpStatus: 403, bucket: 'auth_scope', message: 'missing scope' },
      usageWindows: [],
    });
    assert.ok(lines.some((l) => l.includes('FAILED (403, bucket=auth_scope)')));
    assert.ok(lines.some((l) => l.includes('Message: missing scope')));
  });
});

// issue #110 — formatClaudeLocalUsage / [local] stats-cache.json 블록은 v0.3.0 에서 제거됨.

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
    assert.ok(lines.includes('Command: status'));
    assert.ok(lines.includes('Config: /x/config.json'));
    assert.ok(lines.includes('Codex: enabled'));
    assert.ok(lines.includes('Claude: disabled'));
  });
});

describe('formatClaudeNetworkUsages — multi-account', () => {
  it('renders single "Skipped" line when usages is empty', () => {
    const lines = formatClaudeNetworkUsages([]);
    assert.ok(lines.some((l) => l.includes('Skipped')));
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
    // 단일 계정 블록은 'Account:' 헤더를 붙이지 않음
    assert.ok(!lines.some((l) => l.startsWith('  - Account:')));
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
    assert.ok(lines.some((l) => l.includes('- Account: a:1')));
    assert.ok(lines.some((l) => l.includes('- Account: a:2')));
    assert.ok(lines.some((l) => l.includes('OK (200)')));
    assert.ok(lines.some((l) => l.includes('FAILED (401, bucket=auth)')));
    assert.ok(lines.some((l) => l.includes('Message: expired')));
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
    assert.ok(lines.some((l) => l.includes('- Account: a:1')));
    assert.ok(lines.some((l) => l.includes('- Account: a:2')));
  });

  it('falls back to legacy networkUsage when networkUsages absent', () => {
    const lines = formatClaudeSection({
      authSource: 'claude-cli-import',
      detected: true,
      selectedAccount: null,
      networkUsage: { status: { ok: true, httpStatus: 200 }, usageWindows: [] },
    });
    assert.ok(lines.some((l) => l.includes('OK (200)')));
    // 단일 블록이므로 '- Account:' 헤더 없어야 함
    assert.ok(!lines.some((l) => l.startsWith('  - Account:')));
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
  it('omits "Account filter" line when not set', () => {
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
    assert.ok(!lines.some((l) => l.includes('Account filter')));
  });

  it('includes "Account filter" line when accountFilter present', () => {
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
    assert.ok(lines.includes('Account filter: alice@x.com'));
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
    assert.ok(lines.includes('Provider filter: codex'));
    assert.ok(lines.some((l) => l === 'Codex usage'));
    assert.ok(!lines.some((l) => l === 'Claude usage'));
  });

  it('renders only Claude usage section when providerFilter=claude (no codex key)', () => {
    const lines = formatStatusOutput('usage', {
      ...baseSnapshot,
      providerFilter: 'claude',
      claude: claudeSnap,
    });
    assert.ok(lines.includes('Provider filter: claude'));
    assert.ok(lines.some((l) => l === 'Claude usage'));
    assert.ok(!lines.some((l) => l === 'Codex usage'));
  });

  it('omits "Provider filter" line when not set', () => {
    const lines = formatStatusOutput('status', {
      ...baseSnapshot,
      codex: codexSnap,
      claude: claudeSnap,
    });
    assert.ok(!lines.some((l) => l.startsWith('Provider filter:')));
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
      lines.some((l) => l.includes('No Codex account matches account filter "nope@x.com"')),
    );
  });

  it('falls back to normal "no profile" message when filteredOut=false', () => {
    const lines = formatCodexSection({
      enabled: true,
      authSource: 'agent-store',
      snapshots: [],
    });
    assert.ok(lines.some((l) => l.includes('No Codex OAuth profile found')));
  });
});

describe('formatClaudeNetworkUsages — filteredOut context', () => {
  it('shows filter-specific message when context.filteredOut is set', () => {
    const lines = formatClaudeNetworkUsages([], { filteredOut: true, accountFilter: 'nope' });
    assert.ok(lines.some((l) => l.includes('No Claude account matches account filter "nope"')));
  });
});

describe('formatClaudeSection — Default account line visibility', () => {
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

  it('shows "Default account" line when accountFilter is not set', () => {
    const lines = formatClaudeSection(baseClaude);
    assert.ok(lines.some((l) => l.startsWith('Default account: a:default')));
  });

  it('hides "Default account" line when accountFilter is active', () => {
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
    assert.ok(!lines.some((l) => l.startsWith('Default account:')));
    assert.ok(lines.some((l) => l.includes('OK (200)')));
  });
});

describe('multi-account divider (issue #116 review)', () => {
  const DIVIDER = '─'.repeat(50);

  it('inserts a horizontal divider between Codex snapshots when count > 1', () => {
    const lines = formatCodexSection({
      enabled: true,
      authSource: 'agent-store',
      snapshots: [
        {
          source: 'x',
          authType: 'oauth',
          confidence: 'high',
          account: { profileId: 'a' },
          status: { ok: true, httpStatus: 200 },
          usageWindows: [],
        },
        {
          source: 'x',
          authType: 'oauth',
          confidence: 'high',
          account: { profileId: 'b' },
          status: { ok: true, httpStatus: 200 },
          usageWindows: [],
        },
      ],
    });
    // divider appears exactly once between 2 accounts, at column 0 (no indent).
    const dividerLines = lines.filter((l) => l === DIVIDER);
    assert.equal(dividerLines.length, 1);
    // divider must appear after first account block, before second.
    const idxA = lines.findIndex((l) => l.includes('- a'));
    const idxDiv = lines.indexOf(DIVIDER);
    const idxB = lines.findIndex((l) => l.includes('- b'));
    assert.ok(idxA < idxDiv && idxDiv < idxB);
  });

  it('does not insert a divider when Codex has a single snapshot', () => {
    const lines = formatCodexSection({
      enabled: true,
      authSource: 'agent-store',
      snapshots: [
        {
          source: 'x',
          authType: 'oauth',
          confidence: 'high',
          account: { profileId: 'only' },
          status: { ok: true, httpStatus: 200 },
          usageWindows: [],
        },
      ],
    });
    assert.equal(
      lines.some((l) => l === DIVIDER),
      false,
    );
  });

  it('inserts an indented divider between Claude usages when count > 1', () => {
    const lines = formatClaudeNetworkUsages([
      {
        accountKey: 'a:1',
        snapshot: { status: { ok: true, httpStatus: 200 }, usageWindows: [] },
      },
      {
        accountKey: 'a:2',
        snapshot: { status: { ok: true, httpStatus: 200 }, usageWindows: [] },
      },
    ]);
    // Claude multi-account divider uses 2-space indent to align with `  - Account:` header.
    const indentedDivider = `  ${DIVIDER}`;
    assert.ok(lines.includes(indentedDivider));
    assert.equal(lines.filter((l) => l === indentedDivider).length, 1);
  });

  it('does not insert a divider when Claude has a single usage', () => {
    const lines = formatClaudeNetworkUsages([
      {
        accountKey: 'a:1',
        snapshot: { status: { ok: true, httpStatus: 200 }, usageWindows: [] },
      },
    ]);
    assert.equal(
      lines.some((l) => l.includes(DIVIDER)),
      false,
    );
  });
});

describe('formatStatusOutput — useColor context (issue #116)', () => {
  it('passes useColor through to usage window formatting', () => {
    const snapshot = {
      configPath: '/x',
      providers: { codex: { enabled: true }, claude: { enabled: false } },
      sync: { enabled: false },
      codex: {
        enabled: true,
        authSource: 'agent-store',
        snapshots: [
          {
            source: 'provider_usage_endpoint',
            authType: 'oauth',
            confidence: 'high',
            account: { profileId: 'p1' },
            status: { ok: true, httpStatus: 200 },
            usageWindows: [{ kind: 'primary', usedPercent: 95, resetAt: '2026-04-15' }],
          },
        ],
      },
      claude: {
        authSource: 'not-found',
        detected: false,
        selectedAccount: null,
        networkUsages: [],
      },
    };
    const colored = formatStatusOutput('status', snapshot, { useColor: true });
    const plain = formatStatusOutput('status', snapshot, { useColor: false });
    assert.ok(colored.some((l) => l.includes('\x1b[')));
    assert.ok(!plain.some((l) => l.includes('\x1b[')));
  });

  it('defaults to plain (no ANSI) when ctx is omitted', () => {
    const lines = formatStatusOutput('status', {
      configPath: '/x',
      providers: { codex: { enabled: true }, claude: { enabled: false } },
      sync: { enabled: false },
      codex: {
        enabled: true,
        authSource: 'agent-store',
        snapshots: [
          {
            source: 'provider_usage_endpoint',
            authType: 'oauth',
            confidence: 'high',
            account: { profileId: 'p1' },
            status: { ok: true, httpStatus: 200 },
            usageWindows: [{ kind: 'primary', usedPercent: 95, resetAt: '2026-04-15' }],
          },
        ],
      },
      claude: {
        authSource: 'not-found',
        detected: false,
        selectedAccount: null,
        networkUsages: [],
      },
    });
    assert.ok(!lines.some((l) => l.includes('\x1b[')));
  });
});
