/**
 * doctor codex 출력용 pure formatter + predicate 모음.
 *
 * 모든 format* 함수는 string[] 반환, console.log 호출 없음.
 */

import { formatTokenExpiry } from './doctor-helpers.js';

/**
 * Codex 계정이 mock 또는 refreshToken 없는 placeholder인지 판별.
 */
export function isCodexMockAccount(account) {
  return account.raw?.mock === true || !account.tokens?.refreshToken;
}

/**
 * 대상 계정 기본 정보 요약.
 */
export function formatCodexAccountSummary(account) {
  return [
    `대상 계정: ${account.accountKey}`,
    `선택 이유: ${account._reason}`,
    `email: ${account.email}`,
    `authType: ${account.authType}`,
    `source: ${account.source}`,
    `expiresAt: ${account.expiresAt ?? '(없음)'}`,
  ];
}

/**
 * Mock/placeholder 계정 경고.
 */
export function formatCodexMockGuard(account) {
  const lines = [
    '',
    '⚠ 이 계정은 mock이거나 refreshToken이 없습니다.',
    '  refresh 시도를 건너뜁니다.',
  ];
  if (!account.tokens?.refreshToken) lines.push('  (tokens.refreshToken이 존재하지 않음)');
  if (account.raw?.mock) lines.push('  (raw.mock = true)');
  return lines;
}

/**
 * Dry-run (--refresh-live 없을 때) 상태 출력.
 */
export function formatCodexDryRun(account) {
  const lines = [
    '',
    'refresh 상태 확인만 수행합니다. (dry-run)',
    '실제 refresh를 시도하려면 --refresh-live 옵션을 추가하세요.',
  ];
  const expiry = formatTokenExpiry(account.expiresAt);
  if (expiry) lines.push(expiry);
  return lines;
}
