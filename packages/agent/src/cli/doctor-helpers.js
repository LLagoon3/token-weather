/**
 * doctor-command에서 공유하는 pure formatter들과 refresh-live 실행 헬퍼.
 *
 * pure helper들은 단위 테스트로 검증 가능하도록 console.log를 직접 호출하지 않고
 * 문자열 배열을 반환한다. 실제 출력은 doctor-command에서 처리.
 */

import { refreshClaudeToken } from '@token-weather/provider-adapters/src/claude/refresh-claude-token.js';
import { refreshCodexToken } from '@token-weather/provider-adapters/src/codex/index.js';

/**
 * Claude credential snapshot을 한글 출력 라인 배열로 변환.
 *
 * @param {object} snapshot - getClaudeSnapshot / buildClaudeSnapshot 결과
 * @returns {string[]}
 */
export function formatClaudeSection(snapshot) {
  const lines = [];
  lines.push('Claude credential 상태:');
  lines.push(`  credentialsPath: ${snapshot.credentialsPath}`);
  lines.push(`  found:           ${snapshot.found}`);
  lines.push(`  parsed:          ${snapshot.parsed}`);
  lines.push(`  authSource:      ${snapshot.authSource}`);
  lines.push(`  accountKey:      ${snapshot.selectedAccount?.accountKey ?? '(없음)'}`);
  lines.push(`  authType:        ${snapshot.selectedAccount?.authType ?? '(알 수 없음)'}`);

  const usage = snapshot.usage;
  if (usage && usage.source !== 'not-found') {
    lines.push('');
    lines.push('Claude usage (stats-cache.json):');
    lines.push(`  totalSessions:       ${usage.totalSessions ?? '알 수 없음'}`);
    lines.push(`  totalMessages:       ${usage.totalMessages ?? '알 수 없음'}`);
    lines.push(`  hasModelUsage:       ${usage.hasModelUsage}`);
    lines.push(`  hasDailyModelTokens: ${usage.hasDailyModelTokens}`);
  } else {
    lines.push('  usage: 데이터 없음 (stats-cache.json 미발견)');
  }

  lines.push('');
  lines.push('Claude live usage (api.anthropic.com/api/oauth/usage):');

  // multi-account: networkUsages 배열 우선. 없으면 legacy networkUsage 단일값으로 흡수.
  const usages = Array.isArray(snapshot.networkUsages)
    ? snapshot.networkUsages
    : snapshot.networkUsage
      ? [{ accountKey: snapshot.selectedAccount?.accountKey ?? null, snapshot: snapshot.networkUsage }]
      : [];

  if (usages.length === 0) {
    lines.push('  호출 안 함 (Claude 비활성 또는 토큰 없음)');
    return lines;
  }

  const multi = usages.length > 1;
  for (const { accountKey, snapshot: network } of usages) {
    if (multi) lines.push(`  - 계정: ${accountKey ?? '(unknown)'}`);
    lines.push(...formatClaudeNetworkSnapshot(network, multi ? '    ' : '  '));
  }

  return lines;
}

/**
 * 단일 Claude live usage snapshot → 출력 라인 배열.
 * indent는 multi-account 블록일 때 2칸 더 들여쓴다.
 */
export function formatClaudeNetworkSnapshot(network, indent = '  ') {
  const lines = [];
  if (!network) {
    lines.push(`${indent}호출 안 함`);
    return lines;
  }
  if (network.status?.ok) {
    lines.push(`${indent}상태: OK (${network.status.httpStatus})`);
    lines.push(`${indent}usageWindows: ${network.usageWindows.length}개`);
    for (const window of network.usageWindows) {
      const reset = window.resetAt ? ` reset=${window.resetAt}` : '';
      lines.push(`${indent}  - ${window.kind}: ${window.usedPercent ?? 'unknown'}%${reset}`);
    }
    return lines;
  }
  const http = network.status?.httpStatus ?? 'network/error';
  const bucket = network.status?.bucket ?? 'unknown';
  lines.push(`${indent}상태: 실패 (${http}, bucket=${bucket})`);
  if (network.status?.message) {
    lines.push(`${indent}메시지: ${network.status.message}`);
  }
  return lines;
}

/**
 * 토큰 만료 시각을 "잔여 분 / 만료" 한글 메시지로 변환.
 * @param {string|null} expiresAtIso
 * @param {Date} [now]
 * @returns {string|null}  표시할 메시지 (없으면 null)
 */
export function formatTokenExpiry(expiresAtIso, now = new Date()) {
  if (!expiresAtIso) return null;
  const expires = new Date(expiresAtIso);
  if (Number.isNaN(expires.getTime())) return null;
  const remainingMs = expires.getTime() - now.getTime();
  if (remainingMs <= 0) return `⚠ 토큰이 만료되었습니다. (${expiresAtIso})`;
  const remainingMin = Math.round(remainingMs / 60_000);
  return `토큰 만료까지 약 ${remainingMin}분 남음.`;
}

/**
 * refresh 결과를 한글 출력 라인 배열로 변환.
 * @param {{ tokenType: string, expiresIn: number, scope: string|null, refreshToken: string|null }} tokenResponse
 * @param {string|null} prevRefreshToken - 비교용 (rotation 여부 판정)
 * @returns {string[]}
 */
export function formatRefreshSuccess(tokenResponse, prevRefreshToken) {
  const lines = [];
  lines.push(`  token_type: ${tokenResponse.tokenType}`);
  lines.push(`  expires_in: ${tokenResponse.expiresIn}`);
  lines.push(`  scope: ${tokenResponse.scope ?? '(없음)'}`);
  const rotated = tokenResponse.refreshToken !== prevRefreshToken;
  lines.push(`  refreshToken 변경: ${rotated ? '예 (rotation)' : '아니오 (기존 유지)'}`);
  return lines;
}

/**
 * `--refresh-live` 공통 실행 헬퍼.
 *
 * provider별 refresh 함수를 호출하고, 성공/실패 출력을 통합한다.
 * 성공 시 호출자가 store 갱신 등을 수행할 수 있도록 onSuccess 콜백을 제공.
 *
 * @param {{ providerLabel: string, refreshFn: (params: { refreshToken: string, allowLiveExchange: boolean }) => Promise<object> }} spec
 * @param {string} refreshToken
 * @param {(tokenResponse: object) => Promise<void>|void} [onSuccess]
 * @returns {Promise<void>}
 */
export async function runRefreshLiveAttempt(spec, refreshToken, onSuccess) {
  try {
    const tokenResponse = await spec.refreshFn({ refreshToken, allowLiveExchange: true });
    console.log('✓ refresh 성공');
    for (const line of formatRefreshSuccess(tokenResponse, refreshToken)) {
      console.log(line);
    }
    if (onSuccess) await onSuccess(tokenResponse);
  } catch (err) {
    console.log(`❌ refresh 실패: ${err.message}`);
    if (spec.failureNote) {
      console.log('');
      console.log(spec.failureNote);
    }
  }
}

/** Provider별 refresh spec 사전 구성 (doctor-command에서 import 편의). */
export const CODEX_REFRESH_SPEC = {
  providerLabel: 'Codex',
  refreshFn: refreshCodexToken,
  failureNote:
    '저장된 토큰을 변경하지 않았습니다.\n계정 상태를 확인하거나 `token-weather auth login codex --live-exchange`로 재인증하세요.',
};

export const CLAUDE_REFRESH_SPEC = {
  providerLabel: 'Claude',
  refreshFn: refreshClaudeToken,
  failureNote: null,
};
