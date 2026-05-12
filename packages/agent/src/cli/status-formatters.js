/**
 * status / usage output pure formatters.
 *
 * 모든 함수는 string[] 반환, console.log 호출 없음.
 * status-command.js 의 runStatusCommand 가 결과를 출력한다.
 *
 * 출력 언어는 영어 (사용자가 평문에서 한글 제외 요청, issue #116).
 * 평문은 stable contract 가 아니므로 (docs/cli-json-output.md) 자유 변경.
 *
 * 출력 스타일: claude-code `/usage` 모사 — multi-line block (label / bar+pct /
 * reset). eighth-block precision (`█▏▎▍▌▋▊▉`), 빈 자리는 space.
 */

import { formatProgressBar, formatResetTime, formatWindowLabel } from './status-bar-helper.js';

const BAR_WIDTH = 50;
const DIVIDER_CHAR = '─';
const DIVIDER_WIDTH = 50;

/** 계정 구분용 light horizontal divider — 다 계정일 때만 사이에 삽입. */
function accountDivider(indent = '') {
  return `${indent}${DIVIDER_CHAR.repeat(DIVIDER_WIDTH)}`;
}

/**
 * 전체 status 출력 라인 배열.
 *
 * `snapshot.providerFilter` 가 지정되어 있으면 매칭되지 않는 provider 섹션은
 * 출력하지 않는다. ctx.useColor 는 호출자(runStatusCommand)에서 결정 후 주입.
 *
 * @param {string} command
 * @param {object} snapshot
 * @param {{ useColor?: boolean, now?: Date }} [ctx]
 */
export function formatStatusOutput(command, snapshot, ctx = {}) {
  const lines = [
    `Command: ${command}`,
    'Local agent status summary',
    '-----------------------',
    `Config: ${snapshot.configPath}`,
    `Codex: ${snapshot.providers.codex.enabled ? 'enabled' : 'disabled'}`,
    `Claude: ${snapshot.providers.claude.enabled ? 'enabled' : 'disabled'}`,
    `Server sync: ${snapshot.sync.enabled ? 'enabled' : 'disabled'}`,
  ];
  if (snapshot.accountFilter) {
    lines.push(`Account filter: ${snapshot.accountFilter}`);
  }
  if (snapshot.providerFilter) {
    lines.push(`Provider filter: ${snapshot.providerFilter}`);
  }
  if (snapshot.codex) {
    lines.push('', ...formatCodexSection(snapshot.codex, ctx));
  }
  if (snapshot.claude) {
    lines.push('', ...formatClaudeSection(snapshot.claude, ctx));
  }
  return lines;
}

/** Codex usage section. */
export function formatCodexSection(codex, ctx = {}) {
  const lines = ['Codex usage', '-----------'];

  if (!codex.enabled) {
    lines.push('Disabled');
    return lines;
  }

  lines.push(`Auth source: ${codex.authSource ?? 'unknown'}`);
  if (codex.credentialsPath) {
    lines.push(`Codex CLI credential path: ${codex.credentialsPath}`);
  }

  if (codex.snapshots.length === 0) {
    if (codex.filteredOut) {
      lines.push(`No Codex account matches account filter "${codex.accountFilter}".`);
    } else {
      lines.push('No Codex OAuth profile found.');
    }
    return lines;
  }

  for (let i = 0; i < codex.snapshots.length; i++) {
    const snapshot = codex.snapshots[i];
    if (i > 0) {
      // 다 계정일 때 계정 사이에 light horizontal divider — 첫 계정 앞 / 마지막 뒤엔 없음.
      lines.push('', accountDivider(), '');
    }
    const label = snapshot.account.email
      ? `${snapshot.account.profileId} (${snapshot.account.email})`
      : snapshot.account.profileId;
    lines.push(`- ${label}`);
    lines.push(
      `  Status: ${
        snapshot.status.ok
          ? `OK (${snapshot.status.httpStatus})`
          : `FAILED (${snapshot.status.httpStatus ?? 'network/error'})`
      }`,
    );
    lines.push(
      `  source=${snapshot.source}, authType=${snapshot.authType}, confidence=${snapshot.confidence}`,
    );
    if (snapshot.account.plan) lines.push(`  Plan: ${snapshot.account.plan}`);
    for (const window of snapshot.usageWindows) {
      lines.push('');
      for (const blockLine of formatWindowBlock(window, ctx)) {
        lines.push(`  ${blockLine}`);
      }
    }
    if (snapshot.status.message) lines.push(`  Error: ${snapshot.status.message}`);
  }
  return lines;
}

/** Claude usage section. */
export function formatClaudeSection(claude, ctx = {}) {
  const lines = ['Claude usage', '------------'];
  lines.push(`Auth source: ${claude.authSource}`);
  lines.push(`Credential detected: ${claude.detected}`);
  if (claude.selectedAccount && !claude.accountFilter) {
    lines.push(`Default account: ${formatAccountDisplay(claude.selectedAccount)}`);
  }

  const usages = Array.isArray(claude.networkUsages)
    ? claude.networkUsages
    : claude.networkUsage
      ? [{ accountKey: claude.selectedAccount?.accountKey ?? null, snapshot: claude.networkUsage }]
      : [];
  lines.push(
    ...formatClaudeNetworkUsages(usages, {
      filteredOut: claude.filteredOut,
      accountFilter: claude.accountFilter,
      useColor: ctx.useColor,
      now: ctx.now,
    }),
  );
  return lines;
}

/** Claude live network usage 블록(들). */
export function formatClaudeNetworkUsages(usages, context = {}) {
  const lines = ['', '[live] api.anthropic.com/api/oauth/usage'];
  if (!usages || usages.length === 0) {
    if (context.filteredOut) {
      lines.push(`  No Claude account matches account filter "${context.accountFilter}".`);
    } else {
      lines.push('  Skipped (Claude disabled or no token)');
    }
    return lines;
  }

  for (let i = 0; i < usages.length; i++) {
    const { accountKey, snapshot, account } = usages[i];
    if (usages.length > 1) {
      if (i > 0) {
        // 다 계정일 때 계정 사이에 light horizontal divider — 첫 계정 앞 / 마지막 뒤엔 없음.
        lines.push('', accountDivider('  '), '');
      }
      lines.push(`  - Account: ${formatAccountDisplay(account ?? { accountKey })}`);
    }
    lines.push(...formatClaudeNetworkUsageBody(snapshot, usages.length > 1, context));
  }
  return lines;
}

/** 단일 Claude network usage snapshot 출력. */
export function formatClaudeNetworkUsageBody(networkUsage, indented = false, ctx = {}) {
  const prefix = indented ? '    ' : '  ';
  const lines = [];
  if (!networkUsage) {
    lines.push(`${prefix}Skipped`);
    return lines;
  }

  if (networkUsage.status?.ok) {
    lines.push(`${prefix}Status: OK (${networkUsage.status.httpStatus})`);
    if (networkUsage.usageWindows.length === 0) {
      lines.push(`${prefix}No usageWindows (expected fields missing in response)`);
    }
    for (const window of networkUsage.usageWindows) {
      lines.push(`${prefix}`);
      for (const blockLine of formatWindowBlock(window, ctx)) {
        lines.push(`${prefix}${blockLine}`);
      }
    }
    return lines;
  }

  const http = networkUsage.status?.httpStatus ?? 'network/error';
  const bucket = networkUsage.status?.bucket ?? 'unknown';
  lines.push(`${prefix}Status: FAILED (${http}, bucket=${bucket})`);
  if (networkUsage.status?.message) lines.push(`${prefix}Message: ${networkUsage.status.message}`);
  return lines;
}

/**
 * @deprecated 신규 코드는 formatClaudeNetworkUsages(배열)를 사용.
 */
export function formatClaudeNetworkUsage(networkUsage, ctx = {}) {
  const header = ['', '[live] api.anthropic.com/api/oauth/usage'];
  return [...header, ...formatClaudeNetworkUsageBody(networkUsage, false, ctx)];
}

function formatAccountDisplay(account) {
  if (!account) return '(unknown)';
  const accountKey = account.accountKey ?? '(unknown)';
  const displayName = account.displayName ?? null;
  const email = account.email ?? null;
  if (displayName && email) return `${accountKey} (${displayName} / ${email})`;
  if (displayName) return `${accountKey} (${displayName})`;
  if (email) return `${accountKey} (${email})`;
  return accountKey;
}

/**
 * window 한 개를 3 줄 block 으로 — claude-code `/usage` 스타일.
 *
 * 예시:
 *   Current session (5h)
 *   ██▌                                                  5% used
 *   Resets 2pm (Asia/Seoul)
 *
 * issue #116: `used_percent=N, reset_at=...` 단일 라인 형식의 기존 formatWindow
 * 를 완전 대체. 평문은 stable contract 아님 (docs/cli-json-output.md).
 *
 * @param {object} window
 * @param {{ useColor?: boolean, now?: Date }} [ctx]
 * @returns {string[]} 3 줄 — label / bar+pct / reset
 */
export function formatWindowBlock(window, ctx = {}) {
  const label = formatWindowLabel(window);
  const bar = formatProgressBar(window.usedPercent, {
    width: BAR_WIDTH,
    useColor: ctx.useColor ?? false,
  });
  const pctText =
    window.usedPercent == null || Number.isNaN(window.usedPercent)
      ? ' --'
      : `${Math.round(window.usedPercent)}`.padStart(3);
  const barLine = `${bar} ${pctText}% used`;
  const resetLine = `Resets ${formatResetTime(window.resetAt, ctx.now ?? new Date())}`;
  return [label, barLine, resetLine];
}
