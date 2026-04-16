import { loadAuthStore, saveAuthStore, removeProviderAccount } from '../auth/auth-store.js';
import { resolveAccount } from '../auth/account-resolver.js';

/**
 * `ai-usage-agent auth logout <provider> [--account <id>]`
 *
 * 지정된 provider의 계정을 auth store에서 제거한다.
 * --account 옵션으로 email 또는 accountKey를 지정할 수 있다.
 * 생략 시 기본 선택 계정(resolveDefaultAccount)을 대상으로 한다.
 *
 * 참고: revoke endpoint 호출은 아직 미구현이다. 로컬 저장소 제거만 수행한다.
 */
export async function runAuthLogoutCommand(provider, args) {
  if (!provider) {
    console.error('사용법: ai-usage-agent auth logout <provider> [--account <email|accountKey>]');
    process.exitCode = 1;
    return;
  }

  const options = parseLogoutOptions(args);
  const store = await loadAuthStore();

  const providerEntry = store.providers?.[provider];
  if (!providerEntry || !providerEntry.accounts || providerEntry.accounts.length === 0) {
    console.log(`[${provider}] 저장된 계정이 없습니다.`);
    return;
  }

  const { account, reason } = resolveAccount(providerEntry.accounts, {
    accountIdentifier: options.account,
  });

  if (!account) {
    const messages = {
      'no-accounts': `[${provider}] 저장된 계정이 없습니다.`,
      'all-disabled': `[${provider}] 모든 계정이 이미 비활성 상태입니다.`,
      'not-found': `[${provider}] 계정을 찾을 수 없습니다: ${options.account}`,
      'account-disabled': `[${provider}] 해당 계정은 이미 비활성 상태입니다: ${options.account}`,
    };
    console.log(messages[reason] ?? `[${provider}] 계정을 선택할 수 없습니다 (${reason}).`);
    process.exitCode = 1;
    return;
  }

  // 제거 대상 명확히 출력
  const isMock = account.raw?.mock === true;
  console.log(`제거 대상:`);
  console.log(`  provider   : ${provider}`);
  console.log(`  accountKey : ${account.accountKey}`);
  console.log(`  email      : ${account.email ?? '(없음)'}`);
  console.log(`  source     : ${account.source ?? '(알 수 없음)'}`);
  console.log(`  mock       : ${isMock ? 'yes' : 'no'}`);

  const nextStore = removeProviderAccount(store, provider, account.accountKey);
  await saveAuthStore(nextStore);

  console.log(`\n계정이 로컬 저장소에서 제거되었습니다.`);
  console.log(`참고: provider 측 revoke는 수행되지 않았습니다 (미구현).`);
}

function parseLogoutOptions(args) {
  const options = { account: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--account' && args[i + 1]) {
      options.account = args[i + 1];
      i += 1;
    }
  }
  return options;
}
