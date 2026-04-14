import {
  resolveClaudeCredentialsPath,
  readClaudeCredentials,
} from '../../../provider-adapters/src/claude/read-claude-credentials.js';
import { resolveImportedClaudeSnapshot } from '../../../provider-adapters/src/claude/claude-imported-account.js';
import { resolveClaudeAccount } from '../auth/resolve-claude-account.js';
import { resolveClaudeUsageSourcePath } from '../../../provider-adapters/src/claude/resolve-claude-usage-source.js';
import { readClaudeStatsCache } from '../../../provider-adapters/src/claude/read-claude-stats-cache.js';
import { fetchClaudeUsage } from '../../../provider-adapters/src/claude/fetch-claude-usage.js';
import { CLAUDE_AUTH } from '../../../provider-adapters/src/claude/claude-auth-constants.js';
import { SCHEMA_VERSION } from '../../../schemas/src/index.js';
import { loadAuthStore } from '../auth/auth-store.js';

/**
 * Build the Claude section of the top-level status snapshot.
 *
 * 1. agent-store에서 live Claude 계정 로드
 * 2. claude-cli-import credential도 함께 선택 후보로 사용
 * 3. resolveClaudeAccount로 우선순위(agent-store > claude-cli-import) 적용
 * 4. 활성 계정이 있으면 fetchClaudeUsage로 live usage 조회
 *
 * @param {object} [config]
 * @returns {Promise<object>}
 */
export async function getClaudeSnapshot(
  config = { providers: { claude: { enabled: true } } },
) {
  const agentClaudeAccounts = await loadAgentStoreClaudeAccounts();
  const base = buildClaudeSnapshot(
    resolveClaudeCredentialsPath(),
    readClaudeCredentials,
    agentClaudeAccounts,
    resolveClaudeUsageSourcePath(),
  );

  if (!config.providers?.claude?.enabled) {
    return { ...base, networkUsage: null };
  }

  const profile = resolveClaudeProfileFromSnapshot(base);
  if (!profile) {
    return { ...base, networkUsage: null };
  }

  try {
    const networkUsage = await fetchClaudeUsage(profile);
    return { ...base, networkUsage };
  } catch (error) {
    return {
      ...base,
      networkUsage: createClaudeNetworkFailureSnapshot(profile, error),
    };
  }
}

/**
 * Pure: build a Claude credential + stats-cache snapshot.
 * readFn / readStatsCacheFn 주입 가능 (테스트 편의).
 * Exported for testing.
 */
export function buildClaudeSnapshot(
  credentialsPath,
  readFn = readClaudeCredentials,
  agentClaudeAccounts = [],
  usageSourcePath = resolveClaudeUsageSourcePath(),
  readStatsCacheFn = readClaudeStatsCache,
) {
  const credentials = readFn(credentialsPath);
  const found = credentials !== null;
  const imported = resolveImportedClaudeSnapshot(credentials);
  const { account: selectedAccount, authSource } = resolveClaudeAccount(
    agentClaudeAccounts,
    imported.accounts,
  );
  const statsCache = readStatsCacheFn(usageSourcePath);
  return {
    detected: found || agentClaudeAccounts.length > 0,
    authSource,
    credentialsPath,
    found,
    parsed: found,
    selectedAccount,
    importedAccount: selectedAccount, // backward-compat alias — prefer selectedAccount
    usage: statsCache
      ? {
          source: 'stats-cache-json',
          totalSessions: statsCache.totalSessions,
          totalMessages: statsCache.totalMessages,
          hasModelUsage: statsCache.hasModelUsage,
          hasDailyModelTokens: statsCache.hasDailyModelTokens,
        }
      : { source: 'not-found' },
  };
}

/**
 * Pure: fetchClaudeUsage 호환 profile 추출.
 * claude-cli-import(top-level accessToken)와 agent-store(tokens.accessToken)
 * 두 shape 모두 지원.
 *
 * Exported for testing.
 */
export function resolveClaudeProfileFromSnapshot(snapshot) {
  const account = snapshot?.selectedAccount;
  if (!account) return null;

  const accessToken = account.accessToken ?? account.tokens?.accessToken ?? null;
  if (!accessToken) return null;

  return {
    id: account.accountKey ?? 'claude',
    accessToken,
    accountId: account.accountId ?? null,
    email: account.email ?? null,
  };
}

/**
 * Pure: select effective Claude auth source (Codex 쪽 selectCodexAuthSource과 유사).
 * Priority: agent-store > claude-cli-import > not-found.
 *
 * Exported for testing.
 */
export function selectClaudeAuthSource(agentAccounts, importedCredential) {
  if (agentAccounts && agentAccounts.length > 0) return 'agent-store';
  if (importedCredential !== null && importedCredential !== undefined) return 'claude-cli-import';
  return 'not-found';
}

/**
 * agent-store에 저장된 Claude 계정 중 live token이 있는 항목만 반환.
 * claude-cli-import source는 buildClaudeSnapshot 기반 경로가 별도로 처리한다.
 */
async function loadAgentStoreClaudeAccounts() {
  let store;
  try {
    store = await loadAuthStore();
  } catch {
    return [];
  }

  const provider = store.providers?.[CLAUDE_AUTH.storeProvider];
  if (!provider?.accounts?.length) return [];

  return provider.accounts
    .filter((a) => {
      if (a.status === 'disabled') return false;
      if (a.raw?.mock === true) return false;
      const accessToken = a.tokens?.accessToken ?? a.accessToken ?? null;
      if (!accessToken) return false;
      if (a.source === 'claude-cli-import') return false;
      return true;
    })
    .map((a) => ({
      ...a,
      provider: a.provider ?? 'claude',
      source: a.source ?? 'agent-store',
    }));
}

function createClaudeNetworkFailureSnapshot(profile, error) {
  const capturedAt = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  return {
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `claude:${profile.id}:${capturedAt}`,
    capturedAt,
    provider: { id: 'anthropic-claude', displayName: 'Claude', region: null },
    account: {
      profileId: profile.id,
      accountId: profile.accountId ?? null,
      email: profile.email ?? null,
      plan: null,
    },
    source: 'provider_usage_endpoint',
    authType: 'oauth',
    confidence: 'low',
    status: {
      bucket: 'unknown',
      ok: false,
      httpStatus: null,
      message,
      lastSuccessAt: null,
      lastFailureAt: capturedAt,
    },
    usageWindows: [],
    credits: { balance: null, unit: null },
    raw: { provider: 'anthropic-claude', rawError: message },
  };
}
