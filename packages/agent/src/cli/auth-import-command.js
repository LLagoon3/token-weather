import { resolveClaudeCredentialsPath, readClaudeCredentials } from '../../../provider-adapters/src/claude/read-claude-credentials.js';
import { buildClaudeSnapshot } from '../services/status-service.js';
import { loadAuthStore, saveAuthStore } from '../auth/auth-store.js';
import { importClaudeAccountIntoStore } from '../auth/claude-imported-account.js';

/**
 * auth import <provider>
 * 현재 지원: claude
 */
export async function runAuthImportCommand(
  provider,
  _args = [],
  {
    claudeReadFn = readClaudeCredentials,
    loadStore = loadAuthStore,
    saveStore = saveAuthStore,
  } = {},
) {
  if (!provider) {
    console.log('사용법: ai-usage-agent auth import <provider>');
    console.log('현재 지원 provider: claude');
    return;
  }

  if (provider !== 'claude') {
    console.log(`import는 현재 claude만 지원합니다. 입력된 provider: ${provider}`);
    return;
  }

  const credentialsPath = resolveClaudeCredentialsPath();
  const snapshot = buildClaudeSnapshot(credentialsPath, claudeReadFn);
  const { selectedAccount } = snapshot;

  if (!selectedAccount) {
    console.log('auth import claude');
    console.log('------------------');
    console.log('Claude 계정을 찾을 수 없습니다.');
    console.log('');
    console.log('원인 중 하나일 수 있습니다:');
    console.log('  - Claude CLI가 설치되어 있지 않거나 로그인되지 않았습니다.');
    console.log(`  - credentials 파일이 없습니다: ${credentialsPath}`);
    console.log('');
    console.log('Claude CLI에서 먼저 로그인 후 다시 시도하세요.');
    return;
  }

  const store = await loadStore();
  const { store: nextStore, account, reason } = importClaudeAccountIntoStore(store, selectedAccount);

  if (!account || reason !== 'store-updated') {
    console.log('auth import claude');
    console.log('------------------');
    console.log(`import 실패: ${reason}`);
    return;
  }

  await saveStore(nextStore);

  console.log('auth import claude');
  console.log('------------------');
  console.log('Claude 계정을 auth store에 저장했습니다.');
  console.log('');
  console.log(`  accountKey : ${account.accountKey}`);
  console.log(`  source     : ${account.source}`);
  console.log(`  authType   : ${account.authType}`);
}
