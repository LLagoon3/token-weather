import { loadAuthStore } from '../auth/auth-store.js';
import { buildClaudeSnapshot } from '../services/status-service.js';
import { resolveClaudeCredentialsPath } from '@token-weather/provider-adapters/src/claude/read-claude-credentials.js';

/**
 * `auth list` --help 출력. Pure function.
 */
export function formatAuthListHelp() {
  return [
    'token-weather auth list [provider]',
    '',
    '저장된 인증 계정 목록을 출력합니다.',
    'provider를 지정하면 해당 provider 계정만 출력합니다.',
    '',
    'Options:',
    '  -h, --help   이 도움말 출력',
  ];
}

/**
 * `auth list` 의 데이터 수집을 명령형 출력과 분리한 helper.
 *
 * Phase 3 (#128) 에서 추가 — `@token-weather/telegram` 의 auth-list 핸들러가
 * 동일 데이터를 가져다 Telegram 응답으로 가공할 수 있도록 한다 (의존성 주입
 * 패턴). CLI 의 평문 출력은 `formatAuthListLines` 와 함께 사용.
 *
 * @param {string} [provider] - 특정 provider 만 조회. null/undefined 면 전체.
 * @param {object} [options]
 * @param {() => Promise<object>} [options.loadStore]
 * @param {Function} [options.claudeReadFn]
 * @returns {Promise<{ providers: Array<{ id: string, accounts: object[] }>, claudeImport: object | null }>}
 */
export async function collectAuthListData(provider, options = {}) {
  const loadStore = options.loadStore ?? loadAuthStore;
  const store = await loadStore();
  const providerIds = provider ? [provider] : Object.keys(store.providers ?? {});

  const providersData = providerIds.map((pid) => ({
    id: pid,
    accounts: store.providers?.[pid]?.accounts ?? [],
  }));

  const showClaude = !provider || provider === 'claude';
  let claudeImport = null;
  if (showClaude) {
    const claudePath = resolveClaudeCredentialsPath();
    const agentClaudeAccounts = store.providers?.claude?.accounts ?? [];
    claudeImport = buildClaudeSnapshot(claudePath, options.claudeReadFn, agentClaudeAccounts);
  }

  return { providers: providersData, claudeImport };
}

/**
 * `collectAuthListData()` 결과를 사람-읽기 친화 평문 줄로 변환. CLI / Telegram
 * 공유 contract — Pure function.
 *
 * @param {{ providers: Array<{ id: string, accounts: object[] }>, claudeImport: object | null }} data
 * @param {{ providerFilter?: string | null }} [options]
 * @returns {string[]}
 */
export function formatAuthListLines(data, options = {}) {
  const { providerFilter = null } = options;
  const lines = [];
  let totalCount = 0;

  for (const p of data.providers) {
    if (p.accounts.length === 0) {
      if (providerFilter) lines.push(`[${p.id}] 저장된 계정이 없습니다.`);
      continue;
    }
    lines.push('');
    lines.push(`── ${p.id} ──`);
    for (const acct of p.accounts) {
      totalCount += 1;
      lines.push(...formatAccountLines(acct));
      lines.push('');
    }
  }

  if (totalCount === 0 && !providerFilter) {
    lines.push('저장된 인증 계정이 없습니다.');
  }

  if (data.claudeImport) {
    lines.push('');
    lines.push('── claude (import source) ──');
    lines.push(...formatClaudeImportEntry(data.claudeImport));
    lines.push('');
  }

  return lines;
}

function formatAccountLines(acct) {
  const status = acct.status === 'disabled' ? 'disabled' : 'active';
  const isMock = acct.raw?.mock === true;
  const hasRefresh = !isMock && Boolean(acct.tokens?.refreshToken);
  const expired = acct.expiresAt ? new Date(acct.expiresAt) < new Date() : null;
  return [
    `  accountKey : ${acct.accountKey}`,
    `  email      : ${acct.email ?? '(없음)'}`,
    `  name       : ${acct.displayName ?? '(없음)'}`,
    `  label      : ${acct.label ?? '(없음)'}`,
    `  source     : ${acct.source ?? '(알 수 없음)'}`,
    `  authType   : ${acct.authType ?? '(알 수 없음)'}`,
    `  status     : ${status}`,
    `  mock       : ${isMock ? 'yes' : 'no'}`,
    `  refresh    : ${hasRefresh ? 'available' : 'none'}`,
    `  expiresAt  : ${formatExpiry(acct.expiresAt, expired)}`,
    `  createdAt  : ${acct.createdAt ?? '-'}`,
    `  updatedAt  : ${acct.updatedAt ?? '-'}`,
  ];
}

/**
 * `token-weather auth list [provider]`
 *
 * 저장된 인증 계정 목록을 출력한다. provider를 지정하면 해당 provider 계정만
 * 출력한다. options.claudeReadFn 을 주입하면 실제 파일시스템 대신 사용한다
 * (테스트용).
 */
export async function runAuthListCommand(provider, options = {}) {
  if (provider === '--help' || provider === '-h') {
    for (const line of formatAuthListHelp()) console.log(line);
    return;
  }
  const data = await collectAuthListData(provider, options);
  for (const line of formatAuthListLines(data, { providerFilter: provider ?? null })) {
    console.log(line);
  }
}

/**
 * Claude CLI import source 항목을 auth list 형식으로 포맷한다.
 * 순수 함수 — 테스트 가능.
 */
export function formatClaudeImportEntry(snapshot) {
  const acct = snapshot.selectedAccount;
  const accountKey = acct?.accountKey ?? '(없음)';
  const authType = acct?.authType ?? '(알 수 없음)';
  const importSource = snapshot.found ? 'claude-cli-import' : 'not-found';
  return [
    `  provider        : claude`,
    `  accountKey      : ${accountKey}`,
    `  authType        : ${authType}`,
    `  source          : ${importSource}`,
    `  credentialsPath : ${snapshot.credentialsPath}`,
    `  found           : ${snapshot.found}`,
    `  usable          : ${snapshot.parsed}`,
  ];
}

function formatExpiry(expiresAt, expired) {
  if (!expiresAt) return '(없음)';
  if (expired) return `${expiresAt} (만료됨)`;
  return expiresAt;
}
