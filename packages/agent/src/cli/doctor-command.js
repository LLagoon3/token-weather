import { resolveAgentConfigPath } from '../config/config-path.js';
import { loadAuthStore, saveAuthStore, upsertProviderAccount } from '../auth/auth-store.js';
import { resolveAccount } from '../auth/account-resolver.js';
import { refreshCodexToken } from '../../../provider-adapters/src/codex/index.js';
import { buildClaudeSnapshot } from '../services/status-service.js';
import { resolveClaudeCredentialsPath } from '../../../provider-adapters/src/claude/read-claude-credentials.js';

/**
 * Pure helper: format Claude credential snapshot as display lines.
 * Exported for testing.
 */
export function formatClaudeSection(snapshot) {
  const lines = [];
  lines.push('Claude credential 상태:');
  lines.push(`  credentialsPath: ${snapshot.credentialsPath}`);
  lines.push(`  found:           ${snapshot.found}`);
  lines.push(`  parsed:          ${snapshot.parsed}`);
  lines.push(`  authSource:      ${snapshot.authSource}`);
  return lines;
}

export async function runDoctorCommand(subcommand, args = []) {
  if (subcommand === 'codex') {
    await runDoctorCodex(args);
    return;
  }

  if (subcommand === 'claude') {
    runDoctorClaude();
    return;
  }

  const claudeSnapshot = buildClaudeSnapshot(resolveClaudeCredentialsPath());

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
}

function runDoctorClaude() {
  const snapshot = buildClaudeSnapshot(resolveClaudeCredentialsPath());
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
  }
}

async function runDoctorCodex(args) {
  const options = parseDoctorCodexOptions(args);

  console.log('ai-usage-agent doctor codex');
  console.log('---------------------------');

  // ── Load store and resolve account ────────────────────────────────
  const store = await loadAuthStore();
  const provider = store.providers['openai-codex'];

  if (!provider || !provider.accounts || provider.accounts.length === 0) {
    console.log('openai-codex 계정이 없습니다. `ai-usage-agent auth login codex`로 먼저 로그인하세요.');
    return;
  }

  const refreshableAccounts = provider.accounts.filter((account) => {
    if (account.status === 'disabled') return false;
    if (account.raw?.mock === true) return false;
    if (!account.tokens?.refreshToken) return false;
    return true;
  });

  const candidateAccounts = options.account ? provider.accounts : refreshableAccounts;

  const { account, reason } = resolveAccount(candidateAccounts, {
    accountIdentifier: options.account,
  });

  if (!account) {
    if (!options.account && provider.accounts.length > 0 && refreshableAccounts.length === 0) {
      console.log('refresh 가능한 real 계정을 찾지 못했습니다.');
      console.log('mock 계정만 있거나 refreshToken이 없는 계정만 존재합니다.');
      console.log('`ai-usage-agent auth login codex --live-exchange`로 real token을 먼저 저장하세요.');
      return;
    }

    console.log(`계정을 찾을 수 없습니다. (reason: ${reason})`);
    return;
  }

  console.log(`대상 계정: ${account.accountKey}`);
  console.log(`선택 이유: ${reason}`);
  console.log(`email: ${account.email}`);
  console.log(`authType: ${account.authType}`);
  console.log(`source: ${account.source}`);
  console.log(`expiresAt: ${account.expiresAt ?? '(없음)'}`);

  // ── Mock account guard ────────────────────────────────────────────
  const isMock = account.raw?.mock === true || !account.tokens?.refreshToken;

  if (isMock) {
    console.log('');
    console.log('⚠ 이 계정은 mock이거나 refreshToken이 없습니다.');
    console.log('  refresh 시도를 건너뜁니다.');
    if (!account.tokens?.refreshToken) {
      console.log('  (tokens.refreshToken이 존재하지 않음)');
    }
    if (account.raw?.mock) {
      console.log('  (raw.mock = true)');
    }
    return;
  }

  console.log(`refreshToken 존재: 예`);

  // ── Refresh: opt-in only ──────────────────────────────────────────
  if (!options.refreshLive) {
    console.log('');
    console.log('refresh 상태 확인만 수행합니다. (dry-run)');
    console.log('실제 refresh를 시도하려면 --refresh-live 옵션을 추가하세요.');

    if (account.expiresAt) {
      const now = new Date();
      const expires = new Date(account.expiresAt);
      const remainingMs = expires.getTime() - now.getTime();
      if (remainingMs <= 0) {
        console.log(`⚠ 토큰이 만료되었습니다. (${account.expiresAt})`);
      } else {
        const remainingMin = Math.round(remainingMs / 60_000);
        console.log(`토큰 만료까지 약 ${remainingMin}분 남음.`);
      }
    }
    return;
  }

  // ── Live refresh ──────────────────────────────────────────────────
  console.log('');
  console.log('⚠ --refresh-live: 실제 token endpoint에 refresh POST를 시도합니다.');
  console.log(`  대상 accountKey: ${account.accountKey}`);
  console.log('  주의: client_id는 관찰값(observed)이며 성공이 보장되지 않습니다.');
  console.log('');

  try {
    const tokenResponse = await refreshCodexToken({
      refreshToken: account.tokens.refreshToken,
      allowLiveExchange: true,
    });

    console.log('✓ refresh 성공!');
    console.log(`  token_type: ${tokenResponse.tokenType}`);
    console.log(`  expires_in: ${tokenResponse.expiresIn}`);
    console.log(`  scope: ${tokenResponse.scope ?? '(없음)'}`);

    // ── Update store ──────────────────────────────────────────────
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
      raw: {
        ...account.raw,
        lastRefreshedAt: now.toISOString(),
      },
    };

    const freshStore = await loadAuthStore();
    const nextStore = upsertProviderAccount(freshStore, 'openai-codex', updatedAccount);
    await saveAuthStore(nextStore);

    console.log('');
    console.log('store 갱신 완료:');
    console.log(`  accountKey: ${updatedAccount.accountKey}`);
    console.log(`  expiresAt: ${expiresAt ?? '(없음)'}`);
    console.log(`  refreshToken 변경: ${tokenResponse.refreshToken !== account.tokens.refreshToken ? '예 (rotation)' : '아니오 (기존 유지)'}`);
  } catch (err) {
    console.log(`❌ refresh 실패: ${err.message}`);
    console.log('');
    console.log('저장된 토큰을 변경하지 않았습니다.');
    console.log('계정 상태를 확인하거나 `ai-usage-agent auth login codex --live-exchange`로 재인증하세요.');
  }
}

function parseDoctorCodexOptions(args) {
  const options = {
    refreshLive: false,
    account: null,
  };

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
