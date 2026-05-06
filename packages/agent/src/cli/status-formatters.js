/**
 * status / usage 출력용 pure formatter 모음.
 *
 * 모든 함수는 string[] 반환, console.log 호출 없음.
 * status-command.js의 runStatusCommand가 이 함수들의 결과를 출력한다.
 */

/**
 * 전체 status 출력 라인 배열.
 *
 * `snapshot.providerFilter`가 지정되어 있으면 매칭되지 않는 provider 섹션은
 * 출력하지 않는다 (해당 provider snapshot 자체가 없으므로 안전하게 skip).
 * 헤더의 "Codex 사용 / Claude 사용" 라인은 config 기반이라 그대로 노출한다.
 */
export function formatStatusOutput(command, snapshot) {
  const lines = [
    `명령: ${command}`,
    '로컬 에이전트 상태 요약',
    '-----------------------',
    `설정 파일: ${snapshot.configPath}`,
    `Codex 사용: ${snapshot.providers.codex.enabled ? 'enabled' : 'disabled'}`,
    `Claude 사용: ${snapshot.providers.claude.enabled ? 'enabled' : 'disabled'}`,
    `서버 sync: ${snapshot.sync.enabled ? 'enabled' : 'disabled'}`,
  ];
  if (snapshot.accountFilter) {
    lines.push(`계정 필터: ${snapshot.accountFilter}`);
  }
  if (snapshot.providerFilter) {
    lines.push(`provider 필터: ${snapshot.providerFilter}`);
  }
  if (snapshot.codex) {
    lines.push('', ...formatCodexSection(snapshot.codex));
  }
  if (snapshot.claude) {
    lines.push('', ...formatClaudeSection(snapshot.claude));
  }
  return lines;
}

/** Codex usage section. */
export function formatCodexSection(codex) {
  const lines = ['Codex usage', '-----------'];

  if (!codex.enabled) {
    lines.push('비활성화됨');
    return lines;
  }

  lines.push(`인증 소스: ${codex.authSource ?? 'unknown'}`);
  if (codex.authProfilesPath) {
    lines.push(`Auth profiles 경로: ${codex.authProfilesPath}`);
  }

  if (codex.snapshots.length === 0) {
    if (codex.filteredOut) {
      lines.push(`계정 필터 "${codex.accountFilter}"에 해당하는 Codex 계정을 찾지 못했습니다.`);
    } else {
      lines.push('발견된 Codex OAuth 프로필이 없습니다.');
    }
    return lines;
  }

  for (const snapshot of codex.snapshots) {
    const label = snapshot.account.email
      ? `${snapshot.account.profileId} (${snapshot.account.email})`
      : snapshot.account.profileId;
    lines.push(`- ${label}`);
    lines.push(
      `  상태: ${
        snapshot.status.ok
          ? `OK (${snapshot.status.httpStatus})`
          : `실패 (${snapshot.status.httpStatus ?? 'network/error'})`
      }`,
    );
    lines.push(
      `  source=${snapshot.source}, authType=${snapshot.authType}, confidence=${snapshot.confidence}`,
    );
    if (snapshot.account.plan) lines.push(`  플랜: ${snapshot.account.plan}`);
    for (const window of snapshot.usageWindows) {
      lines.push(`  ${window.kind}: ${formatWindow(window)}`);
    }
    if (snapshot.status.message) lines.push(`  에러: ${snapshot.status.message}`);
  }
  return lines;
}

/** Claude usage section. */
export function formatClaudeSection(claude) {
  const lines = ['Claude usage', '------------'];
  lines.push(`인증 소스: ${claude.authSource}`);
  lines.push(`credential 감지: ${claude.detected}`);
  if (claude.selectedAccount && !claude.accountFilter) {
    lines.push(`기본 계정: ${formatAccountDisplay(claude.selectedAccount)}`);
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
    }),
  );
  return lines;
}

/** Claude live network usage 블록(들). */
export function formatClaudeNetworkUsages(usages, context = {}) {
  const lines = ['', '[live] api.anthropic.com/api/oauth/usage'];
  if (!usages || usages.length === 0) {
    if (context.filteredOut) {
      lines.push(
        `  계정 필터 "${context.accountFilter}"에 해당하는 Claude 계정을 찾지 못했습니다.`,
      );
    } else {
      lines.push('  호출 안 함 (Claude 비활성 또는 토큰 없음)');
    }
    return lines;
  }

  for (const { accountKey, snapshot, account } of usages) {
    if (usages.length > 1)
      lines.push(`  - 계정: ${formatAccountDisplay(account ?? { accountKey })}`);
    lines.push(...formatClaudeNetworkUsageBody(snapshot, usages.length > 1));
  }
  return lines;
}

/** 단일 Claude network usage snapshot 출력. */
export function formatClaudeNetworkUsageBody(networkUsage, indented = false) {
  const prefix = indented ? '    ' : '  ';
  const lines = [];
  if (!networkUsage) {
    lines.push(`${prefix}호출 안 함`);
    return lines;
  }

  if (networkUsage.status?.ok) {
    lines.push(`${prefix}상태: OK (${networkUsage.status.httpStatus})`);
    if (networkUsage.usageWindows.length === 0) {
      lines.push(`${prefix}usageWindows 없음 (응답에 기대한 필드가 없었음)`);
    }
    for (const window of networkUsage.usageWindows) {
      lines.push(`${prefix}${window.kind}: ${formatWindow(window)}`);
    }
    return lines;
  }

  const http = networkUsage.status?.httpStatus ?? 'network/error';
  const bucket = networkUsage.status?.bucket ?? 'unknown';
  lines.push(`${prefix}상태: 실패 (${http}, bucket=${bucket})`);
  if (networkUsage.status?.message) lines.push(`${prefix}메시지: ${networkUsage.status.message}`);
  return lines;
}

/**
 * @deprecated 신규 코드는 formatClaudeNetworkUsages(배열)를 사용.
 */
export function formatClaudeNetworkUsage(networkUsage) {
  const header = ['', '[live] api.anthropic.com/api/oauth/usage'];
  return [...header, ...formatClaudeNetworkUsageBody(networkUsage, false)];
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

export function formatWindow(window) {
  const reset = window.resetAt ? `reset_at=${window.resetAt}` : 'reset_at=unknown';
  const used = window.usedPercent ?? 'unknown';
  return `used_percent=${used}, ${reset}`;
}
