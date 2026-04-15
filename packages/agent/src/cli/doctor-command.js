import { resolveAgentConfigPath } from '../config/config-path.js';
import { loadAuthStore, saveAuthStore, upsertProviderAccount } from '../auth/auth-store.js';
import { resolveAccount } from '../auth/account-resolver.js';
import { getClaudeSnapshot } from '../services/status-service.js';
import {
  formatClaudeSection,
  formatTokenExpiry,
  runRefreshLiveAttempt,
  CODEX_REFRESH_SPEC,
  CLAUDE_REFRESH_SPEC,
} from './doctor-helpers.js';

// formatClaudeSection은 doctor-helpers로 이전했지만 외부(CLI 테스트)에서 같은 모듈
// 경로로 import하던 이력을 지키기 위해 re-export.
export { formatClaudeSection };

/**
 * `ai-usage-agent doctor [subcommand] [options]`
 */
export async function runDoctorCommand(subcommand, args = []) {
  if (subcommand === 'codex') {
    await runDoctorCodex(args);
    return;
  }
  if (subcommand === 'claude') {
    await runDoctorClaude(args);
    return;
  }
  await runDoctorRoot();
}

async function runDoctorRoot() {
  const claudeSnapshot = await getClaudeSnapshot();
  console.log('ai-usage-agent doctor');
  console.log('---------------------');
  console.log(`예상 설정 파일 경로: ${resolveAgentConfigPath()}`);
  console.log('');
  for (const line of formatClaudeSection(claudeSnapshot)) {
    console.log(line);
  }
  console.log('');
  console.log('서브커맨드:');
  console.log('  ai-usage-agent doctor codex                 codex 계정 상태 점검');
  console.log('  ai-usage-agent doctor codex --refresh-live  실제 refresh token 재발급 시도');
  console.log('  ai-usage-agent doctor codex --account <id>  특정 계정 지정');
  console.log('  ai-usage-agent doctor claude                claude credential 상태 점검');
  console.log('  ai-usage-agent doctor claude --refresh-live Claude OAuth refresh token으로 실제 재발급 시도');
}

// ─── Claude ────────────────────────────────────────────────────────────────

async function runDoctorClaude(args = []) {
  const options = parseDoctorClaudeOptions(args);
  const snapshot = await getClaudeSnapshot();

  console.log('ai-usage-agent doctor claude');
  console.log('----------------------------');
  for (const line of formatClaudeSection(snapshot)) {
    console.log(line);
  }

  if (!snapshot.found) {
    console.log('');
    console.log('⚠ Claude credential을 찾지 못했습니다.');
    console.log(`  예상 경로: ${snapshot.credentialsPath}`);
    console.log('  Claude CLI로 먼저 로그인했는지 확인하세요.');
    return;
  }

  if (!options.refreshLive) return;
  await runDoctorClaudeRefreshLive(snapshot);
}

async function runDoctorClaudeRefreshLive(snapshot) {
  const account = snapshot.selectedAccount;
  const refreshToken = account?.refreshToken ?? account?.tokens?.refreshToken ?? null;

  console.log('');
  console.log('⚠ --refresh-live: 실제 token endpoint에 refresh POST를 시도합니다.');
  console.log('  주의: client_id는 Claude Code 바이너리 관찰값 기반이며 성공이 보장되지 않습니다.');

  if (!refreshToken) {
    console.log('');
    console.log('selectedAccount에서 refreshToken을 찾을 수 없습니다.');
    console.log('Claude CLI에서 최신 로그인 상태인지 확인하세요.');
    return;
  }

  console.log('');
  await runRefreshLiveAttempt(CLAUDE_REFRESH_SPEC, refreshToken, () => {
    console.log('');
    console.log('ℹ 현재는 결과만 표시합니다. Claude agent-store 연결은 별도 단계에서 붙입니다.');
  });
}

export function parseDoctorClaudeOptions(args) {
  const options = { refreshLive: false };
  for (const arg of args ?? []) {
    if (arg === '--refresh-live') options.refreshLive = true;
  }
  return options;
}

// ─── Codex ─────────────────────────────────────────────────────────────────

async function runDoctorCodex(args) {
  const options = parseDoctorCodexOptions(args);

  console.log('ai-usage-agent doctor codex');
  console.log('---------------------------');

  const account = await resolveCodexDoctorAccount(options);
  if (!account) return;

  printCodexAccountSummary(account);

  if (isCodexMockAccount(account)) {
    printCodexMockGuard(account);
    return;
  }
  console.log('refreshToken 존재: 예');

  if (!options.refreshLive) {
    printCodexDryRun(account);
    return;
  }

  console.log('');
  console.log('⚠ --refresh-live: 실제 token endpoint에 refresh POST를 시도합니다.');
  console.log(`  대상 accountKey: ${account.accountKey}`);
  console.log('  주의: client_id는 관찰값(observed)이며 성공이 보장되지 않습니다.');
  console.log('');

  await runRefreshLiveAttempt(
    CODEX_REFRESH_SPEC,
    account.tokens.refreshToken,
    (tokenResponse) => updateCodexStoreAfterRefresh(account, tokenResponse),
  );
}

async function resolveCodexDoctorAccount(options) {
  const store = await loadAuthStore();
  const provider = store.providers['openai-codex'];
  if (!provider?.accounts?.length) {
    console.log('openai-codex 계정이 없습니다. `ai-usage-agent auth login codex`로 먼저 로그인하세요.');
    return null;
  }

  const refreshableAccounts = provider.accounts.filter(
    (a) =>
      a.status !== 'disabled' && a.raw?.mock !== true && a.tokens?.refreshToken,
  );
  const candidateAccounts = options.account ? provider.accounts : refreshableAccounts;

  const { account, reason } = resolveAccount(candidateAccounts, {
    accountIdentifier: options.account,
  });

  if (!account) {
    if (!options.account && refreshableAccounts.length === 0) {
      console.log('refresh 가능한 real 계정을 찾지 못했습니다.');
      console.log('mock 계정만 있거나 refreshToken이 없는 계정만 존재합니다.');
      console.log('`ai-usage-agent auth login codex --live-exchange`로 real token을 먼저 저장하세요.');
      return null;
    }
    console.log(`계정을 찾을 수 없습니다. (reason: ${reason})`);
    return null;
  }

  account._reason = reason;
  return account;
}

function isCodexMockAccount(account) {
  return account.raw?.mock === true || !account.tokens?.refreshToken;
}

function printCodexAccountSummary(account) {
  console.log(`대상 계정: ${account.accountKey}`);
  console.log(`선택 이유: ${account._reason}`);
  console.log(`email: ${account.email}`);
  console.log(`authType: ${account.authType}`);
  console.log(`source: ${account.source}`);
  console.log(`expiresAt: ${account.expiresAt ?? '(없음)'}`);
}

function printCodexMockGuard(account) {
  console.log('');
  console.log('⚠ 이 계정은 mock이거나 refreshToken이 없습니다.');
  console.log('  refresh 시도를 건너뜁니다.');
  if (!account.tokens?.refreshToken) console.log('  (tokens.refreshToken이 존재하지 않음)');
  if (account.raw?.mock) console.log('  (raw.mock = true)');
}

function printCodexDryRun(account) {
  console.log('');
  console.log('refresh 상태 확인만 수행합니다. (dry-run)');
  console.log('실제 refresh를 시도하려면 --refresh-live 옵션을 추가하세요.');
  const expiry = formatTokenExpiry(account.expiresAt);
  if (expiry) console.log(expiry);
}

async function updateCodexStoreAfterRefresh(account, tokenResponse) {
  const now = new Date();
  const expiresAt = tokenResponse.expiresIn
    ? new Date(now.getTime() + tokenResponse.expiresIn * 1000).toISOString()
    : null;

  const updatedAccount = {
    ...account,
    tokens: {
      ...account.tokens,
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
    },
    expiresAt,
    updatedAt: now.toISOString(),
    lastUsedAt: now.toISOString(),
    raw: { ...account.raw, lastRefreshedAt: now.toISOString() },
  };

  const freshStore = await loadAuthStore();
  const nextStore = upsertProviderAccount(freshStore, 'openai-codex', updatedAccount);
  await saveAuthStore(nextStore);

  console.log('');
  console.log('store 갱신 완료:');
  console.log(`  accountKey: ${updatedAccount.accountKey}`);
  console.log(`  expiresAt: ${expiresAt ?? '(없음)'}`);
}

function parseDoctorCodexOptions(args) {
  const options = { refreshLive: false, account: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--refresh-live') options.refreshLive = true;
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
