import { resolveAgentConfigPath } from '../config/config-path.js';
import { loadAuthStore } from '../auth/auth-store.js';
import { resolveAccount } from '../auth/account-resolver.js';
import { getClaudeSnapshot } from '../services/status-service.js';
import { CLAUDE_AUTH } from '../../../provider-adapters/src/claude/claude-auth-constants.js';
import {
  formatClaudeSection,
  runRefreshLiveAttempt,
  CODEX_REFRESH_SPEC,
  CLAUDE_REFRESH_SPEC,
} from './doctor-helpers.js';
import {
  isCodexMockAccount,
  formatCodexAccountSummary,
  formatCodexMockGuard,
  formatCodexDryRun,
} from './doctor-codex-helpers.js';
import { updateCodexStoreAfterRefresh } from '../auth/codex-refresh-store.js';
import { updateClaudeStoreAfterRefresh } from '../auth/claude-refresh-store.js';
import { parseCliOptions } from './parse-options.js';

const DOCTOR_FLAGS = {
  '--refresh-live': { key: 'refreshLive', type: 'boolean' },
  '--account': { key: 'account', type: 'string' },
};
const DOCTOR_DEFAULTS = { refreshLive: false, account: null };

function parseDoctorOptions(args) {
  return parseCliOptions(args, { defaults: DOCTOR_DEFAULTS, flags: DOCTOR_FLAGS, includeHelp: true });
}

/**
 * `doctor` root 서브커맨드의 --help 출력. Pure function.
 */
export function formatDoctorHelp() {
  return [
    'ai-usage-agent doctor [subcommand] [options]',
    '',
    '공통 환경 점검 또는 provider별 상세 진단.',
    '',
    'Subcommands:',
    '  codex     Codex 계정·refresh 가능성 점검',
    '  claude    Claude credential·live usage 점검',
    '',
    'Options:',
    '  -h, --help   이 도움말 출력',
    '',
    '예시:',
    '  ai-usage-agent doctor',
    '  ai-usage-agent doctor codex --refresh-live',
    '  ai-usage-agent doctor claude --account work',
  ];
}

/**
 * `doctor codex` 서브커맨드의 --help 출력. Pure function.
 */
export function formatDoctorCodexHelp() {
  return [
    'ai-usage-agent doctor codex [options]',
    '',
    'Codex 계정 상태와 refresh 가능성을 점검합니다.',
    '',
    'Options:',
    '  --refresh-live        실제 token endpoint에 refresh POST 시도',
    '  --account <id>        특정 계정 지정 (email / accountKey / label)',
    '  -h, --help            이 도움말 출력',
  ];
}

/**
 * `doctor claude` 서브커맨드의 --help 출력. Pure function.
 */
export function formatDoctorClaudeHelp() {
  return [
    'ai-usage-agent doctor claude [options]',
    '',
    'Claude credential 상태와 live usage를 점검합니다.',
    '',
    'Options:',
    '  --refresh-live        Claude OAuth refresh token으로 실제 재발급 시도',
    '  --account <id>        특정 계정 지정 (email / accountKey / label)',
    '  -h, --help            이 도움말 출력',
  ];
}

// 기존 import 경로 호환 re-export.
export { formatClaudeSection };
export { updateClaudeStoreAfterRefresh } from '../auth/claude-refresh-store.js';

// ─── Dispatcher ────────────────────────────────────────────────────────────

export async function runDoctorCommand(subcommand, args = []) {
  if (subcommand === 'codex') {
    await runDoctorCodex(args);
    return;
  }
  if (subcommand === 'claude') {
    await runDoctorClaude(args);
    return;
  }
  await runDoctorRoot(args);
}

async function runDoctorRoot(args = []) {
  const options = parseDoctorOptions(args);
  if (options.help) {
    for (const line of formatDoctorHelp()) console.log(line);
    return;
  }
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
  console.log('  ai-usage-agent doctor claude                   claude credential 상태 점검');
  console.log('  ai-usage-agent doctor claude --refresh-live    Claude OAuth refresh token으로 실제 재발급');
  console.log('  ai-usage-agent doctor claude --refresh-live --account <id>');
  console.log('                                                 특정 계정 지정 (email / accountKey / label)');
}

// ─── Claude ────────────────────────────────────────────────────────────────

async function runDoctorClaude(args = []) {
  const options = parseDoctorClaudeOptions(args);
  if (options.help) {
    for (const line of formatDoctorClaudeHelp()) console.log(line);
    return;
  }
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
  await runDoctorClaudeRefreshLive(snapshot, { accountIdentifier: options.account });
}

async function runDoctorClaudeRefreshLive(snapshot, { accountIdentifier } = {}) {
  console.log('');
  console.log('⚠ --refresh-live: 실제 token endpoint에 refresh POST를 시도합니다.');
  console.log('  주의: client_id는 Claude Code 바이너리 관찰값 기반이며 성공이 보장되지 않습니다.');

  const account = await resolveClaudeRefreshTargetAccount(snapshot, accountIdentifier);
  if (!account) return;

  const refreshToken = account?.refreshToken ?? account?.tokens?.refreshToken ?? null;
  if (!refreshToken) {
    console.log('');
    console.log(`대상 계정(${account.accountKey})에서 refreshToken을 찾을 수 없습니다.`);
    return;
  }

  console.log('');
  console.log(`대상 계정: ${account.accountKey}`);

  const isImportSource = account?.source === 'claude-cli-import';

  console.log('');
  await runRefreshLiveAttempt(CLAUDE_REFRESH_SPEC, refreshToken, async (tokenResponse) => {
    if (isImportSource) {
      console.log('');
      console.log('ℹ claude-cli-import 출처 — agent-store에 저장하지 않습니다.');
      console.log('  agent-store에 유지하려면 `auth login claude --live-exchange`로 재로그인하세요.');
      return;
    }
    const result = await updateClaudeStoreAfterRefresh(account, tokenResponse);
    console.log('');
    console.log('store 갱신 완료:');
    console.log(`  accountKey: ${result.accountKey}`);
    console.log(`  expiresAt: ${result.expiresAt ?? '(없음)'}`);
  });
}

/**
 * refresh 대상 Claude 계정 선택. Exported for testing.
 */
export async function resolveClaudeRefreshTargetAccount(snapshot, accountIdentifier) {
  if (!accountIdentifier) {
    if (!snapshot.selectedAccount) {
      console.log('');
      console.log('선택 가능한 Claude 계정이 없습니다.');
      return null;
    }
    return snapshot.selectedAccount;
  }

  const store = await loadAuthStore();
  const accounts = store.providers?.[CLAUDE_AUTH.storeProvider]?.accounts ?? [];
  if (accounts.length === 0) {
    console.log('');
    console.log('agent-store에 저장된 Claude 계정이 없습니다.');
    return null;
  }

  const { account, reason } = resolveAccount(accounts, { accountIdentifier });
  if (!account) {
    console.log('');
    console.log(`계정을 찾을 수 없습니다. (reason: ${reason})`);
    return null;
  }
  return account;
}

export function parseDoctorClaudeOptions(args) {
  return parseCliOptions(args, { defaults: DOCTOR_DEFAULTS, flags: DOCTOR_FLAGS, includeHelp: true });
}

// ─── Codex ─────────────────────────────────────────────────────────────────

async function runDoctorCodex(args) {
  const options = parseDoctorCodexOptions(args);
  if (options.help) {
    for (const line of formatDoctorCodexHelp()) console.log(line);
    return;
  }

  console.log('ai-usage-agent doctor codex');
  console.log('---------------------------');

  const account = await resolveCodexDoctorAccount(options);
  if (!account) return;

  for (const line of formatCodexAccountSummary(account)) console.log(line);

  if (isCodexMockAccount(account)) {
    for (const line of formatCodexMockGuard(account)) console.log(line);
    return;
  }
  console.log('refreshToken 존재: 예');

  if (!options.refreshLive) {
    for (const line of formatCodexDryRun(account)) console.log(line);
    return;
  }

  console.log('');
  console.log('⚠ --refresh-live: 실제 token endpoint에 refresh POST를 시도합니다.');
  console.log(`  대상 accountKey: ${account.accountKey}`);
  console.log('');

  await runRefreshLiveAttempt(
    CODEX_REFRESH_SPEC,
    account.tokens.refreshToken,
    async (tokenResponse) => {
      const result = await updateCodexStoreAfterRefresh(account, tokenResponse);
      console.log('');
      console.log('store 갱신 완료:');
      console.log(`  accountKey: ${result.accountKey}`);
      console.log(`  expiresAt: ${result.expiresAt ?? '(없음)'}`);
    },
  );
}

async function resolveCodexDoctorAccount(options) {
  const store = await loadAuthStore();
  const provider = store.providers['openai-codex'];
  if (!provider?.accounts?.length) {
    console.log('openai-codex 계정이 없습니다.');
    return null;
  }

  const refreshableAccounts = provider.accounts.filter(
    (a) => a.status !== 'disabled' && a.raw?.mock !== true && a.tokens?.refreshToken,
  );
  const candidateAccounts = options.account ? provider.accounts : refreshableAccounts;

  const { account, reason } = resolveAccount(candidateAccounts, {
    accountIdentifier: options.account,
  });

  if (!account) {
    if (!options.account && refreshableAccounts.length === 0) {
      console.log('refresh 가능한 real 계정을 찾지 못했습니다.');
      return null;
    }
    console.log(`계정을 찾을 수 없습니다. (reason: ${reason})`);
    return null;
  }

  account._reason = reason;
  return account;
}

function parseDoctorCodexOptions(args) {
  return parseCliOptions(args, { defaults: DOCTOR_DEFAULTS, flags: DOCTOR_FLAGS, includeHelp: true });
}
