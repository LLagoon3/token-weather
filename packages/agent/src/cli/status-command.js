import { getStatusSnapshot } from '../services/status-service.js';

export const STATUS_COMMANDS = ['status', 'usage'];

/**
 * `status` / `usage` 진입점.
 * 출력 라인 생성은 pure formatter에 위임하고, 본 함수는 console.log만 담당.
 *
 * @param {string} command
 * @param {string[]} [args] - CLI args (e.g. ['--account', 'alice@x.com'])
 */
export async function runStatusCommand(command, args = []) {
  const options = parseStatusOptions(args);
  const snapshot = await getStatusSnapshot({ accountFilter: options.account });
  for (const line of formatStatusOutput(command, snapshot)) {
    console.log(line);
  }
}

/**
 * `status` / `usage` 옵션 파서.
 * 현재 지원: `--account <id>` (email / accountKey 매치).
 * Unknown flag는 무시.
 *
 * @param {string[]} args
 * @returns {{ account: string|null }}
 */
export function parseStatusOptions(args) {
  const options = { account: null };
  for (let i = 0; i < (args ?? []).length; i += 1) {
    const arg = args[i];
    if (arg === '--account') {
      const value = args[i + 1];
      if (value) {
        options.account = value;
        i += 1;
      }
    }
  }
  return options;
}

/**
 * 전체 status 출력 라인 배열을 만드는 pure 함수.
 * @param {string} command
 * @param {object} snapshot - getStatusSnapshot 결과
 * @returns {string[]}
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
  lines.push(
    '',
    ...formatCodexSection(snapshot.codex),
    '',
    ...formatClaudeSection(snapshot.claude),
  );
  return lines;
}

/** Pure formatter: Codex usage section. */
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

/** Pure formatter: Claude usage section. */
export function formatClaudeSection(claude) {
  const lines = ['Claude usage', '------------'];
  lines.push(`인증 소스: ${claude.authSource}`);
  lines.push(`credential 감지: ${claude.detected}`);
  // `기본 계정` 라인은 accountFilter가 없을 때만 표시한다.
  // 필터가 걸려 있으면 아래 네트워크 조회 블록에 실제 조회 대상이 드러나고,
  // 상단 'accountFilter' 라인에서 필터 값도 이미 보이므로 혼동을 피하기 위해 생략.
  if (claude.selectedAccount && !claude.accountFilter) {
    lines.push(`기본 계정: ${claude.selectedAccount.accountKey}`);
  }

  // Multi-account: networkUsages 배열 우선. 없으면 networkUsage 단일 값으로 fallback.
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
  lines.push(...formatClaudeLocalUsage(claude.usage));
  return lines;
}

/**
 * Pure formatter: Claude live network usage 블록(들).
 * usages가 비어 있으면 "호출 안 함" 단일 블록, 여러 개면 계정별 블록 반복.
 */
export function formatClaudeNetworkUsages(usages, context = {}) {
  const lines = ['', '[live] api.anthropic.com/api/oauth/usage'];
  if (!usages || usages.length === 0) {
    if (context.filteredOut) {
      lines.push(`  계정 필터 "${context.accountFilter}"에 해당하는 Claude 계정을 찾지 못했습니다.`);
    } else {
      lines.push('  호출 안 함 (Claude 비활성 또는 토큰 없음)');
    }
    return lines;
  }

  for (const { accountKey, snapshot } of usages) {
    if (usages.length > 1) lines.push(`  - 계정: ${accountKey ?? '(unknown)'}`);
    lines.push(...formatClaudeNetworkUsageBody(snapshot, usages.length > 1));
  }
  return lines;
}

/**
 * 단일 Claude network usage snapshot 출력 (들여쓰기 포함).
 * @param {object|null} networkUsage
 * @param {boolean} indented - multi-account 블록일 때 true → 추가 들여쓰기
 */
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
 * 기존 이름 유지(backward compat): 단일 networkUsage 객체를 받는 구 시그니처.
 * 신규 코드는 formatClaudeNetworkUsages(배열)를 권장.
 */
export function formatClaudeNetworkUsage(networkUsage) {
  const header = ['', '[live] api.anthropic.com/api/oauth/usage'];
  return [...header, ...formatClaudeNetworkUsageBody(networkUsage, false)];
}

/** Pure formatter: Claude local stats-cache block. */
export function formatClaudeLocalUsage(usage) {
  const lines = ['', '[local] stats-cache.json'];
  if (!usage || usage.source === 'not-found') {
    lines.push('  데이터 없음 (stats-cache.json 미발견)');
    return lines;
  }
  lines.push(`  총 세션 수: ${usage.totalSessions ?? '알 수 없음'}`);
  lines.push(`  총 메시지 수: ${usage.totalMessages ?? '알 수 없음'}`);
  lines.push(`  모델별 usage: ${usage.hasModelUsage ? '있음' : '없음'}`);
  lines.push(`  일별 token 통계: ${usage.hasDailyModelTokens ? '있음' : '없음'}`);
  return lines;
}

export function formatWindow(window) {
  const reset = window.resetAt ? `reset_at=${window.resetAt}` : 'reset_at=unknown';
  const used = window.usedPercent ?? 'unknown';
  return `used_percent=${used}, ${reset}`;
}
