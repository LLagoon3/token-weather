import { loadAuthStore } from '../auth/auth-store.js';

/**
 * `ai-usage-agent auth list [provider]`
 *
 * 저장된 인증 계정 목록을 출력한다.
 * provider를 지정하면 해당 provider 계정만 출력한다.
 */
export async function runAuthListCommand(provider) {
  const store = await loadAuthStore();
  const providerIds = provider
    ? [provider]
    : Object.keys(store.providers ?? {});

  if (providerIds.length === 0) {
    console.log('저장된 인증 계정이 없습니다.');
    return;
  }

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

      const expired = acct.expiresAt
        ? new Date(acct.expiresAt) < new Date()
        : null;

      const lines = [
        `  accountKey : ${acct.accountKey}`,
        `  email      : ${acct.email ?? '(없음)'}`,
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
}

function formatExpiry(expiresAt, expired) {
  if (!expiresAt) return '(없음)';
  if (expired) return `${expiresAt} (만료됨)`;
  return expiresAt;
}
