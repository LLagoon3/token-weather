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
 * `token-weather auth list [provider]`
 *
 * 저장된 인증 계정 목록을 출력한다.
 * provider를 지정하면 해당 provider 계정만 출력한다.
 * options.claudeReadFn 을 주입하면 실제 파일시스템 대신 사용한다 (테스트용).
 */
export async function runAuthListCommand(provider, options = {}) {
  if (provider === '--help' || provider === '-h') {
    for (const line of formatAuthListHelp()) console.log(line);
    return;
  }
  const loadStore = options.loadStore ?? loadAuthStore;
  const store = await loadStore();
  const providerIds = provider ? [provider] : Object.keys(store.providers ?? {});

  let totalCount = 0;

  for (const pid of providerIds) {
    const entry = store.providers?.[pid];
    if (!entry || !entry.accounts || entry.accounts.length === 0) {
      if (provider) {
        console.log(`[${pid}] 저장된 계정이 없습니다.`);
      }
      continue;
    }

    console.log(`\n── ${pid} ──`);

    for (const acct of entry.accounts) {
      totalCount += 1;
      const status = acct.status === 'disabled' ? 'disabled' : 'active';
      const isMock = acct.raw?.mock === true;
      const isLive = acct.raw?.liveExchange === true;
      const hasRefresh = !isMock && Boolean(acct.tokens?.refreshToken);

      const expired = acct.expiresAt ? new Date(acct.expiresAt) < new Date() : null;

      const lines = [
        `  accountKey : ${acct.accountKey}`,
        `  email      : ${acct.email ?? '(없음)'}`,
        `  name       : ${acct.displayName ?? '(없음)'}`,
        `  label      : ${acct.label ?? '(없음)'}`,
        `  source     : ${acct.source ?? '(알 수 없음)'}`,
        `  authType   : ${acct.authType ?? '(알 수 없음)'}`,
        `  status     : ${status}`,
        `  mock       : ${isMock ? 'yes' : 'no'}`,
        `  liveToken  : ${isLive ? 'yes' : 'no'}`,
        `  refresh    : ${hasRefresh ? 'available' : 'none'}`,
        `  expiresAt  : ${formatExpiry(acct.expiresAt, expired)}`,
        `  createdAt  : ${acct.createdAt ?? '-'}`,
        `  updatedAt  : ${acct.updatedAt ?? '-'}`,
      ];

      console.log(lines.join('\n'));
      console.log();
    }
  }

  if (totalCount === 0 && !provider) {
    console.log('저장된 인증 계정이 없습니다.');
  }

  // Claude CLI import source — provider 필터가 없거나 'claude'인 경우에 표시
  const showClaude = !provider || provider === 'claude';
  if (showClaude) {
    const claudePath = resolveClaudeCredentialsPath();
    const agentClaudeAccounts = store.providers?.claude?.accounts ?? [];
    const snapshot = buildClaudeSnapshot(claudePath, options.claudeReadFn, agentClaudeAccounts);
    console.log('\n── claude (import source) ──');
    console.log(formatClaudeImportEntry(snapshot).join('\n'));
    console.log();
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
