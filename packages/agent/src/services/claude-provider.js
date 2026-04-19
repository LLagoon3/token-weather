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
import { loadAuthStore } from '../auth/auth-store.js';
import { buildUsageSnapshot } from '../../../provider-adapters/src/shared/usage-snapshot.js';
import { resolveProviderProfiles } from './provider-profile-resolver.js';

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
  options = {},
) {
  const agentClaudeAccounts = await loadAgentStoreClaudeAccounts();
  const base = buildClaudeSnapshot(
    resolveClaudeCredentialsPath(),
    readClaudeCredentials,
    agentClaudeAccounts,
    resolveClaudeUsageSourcePath(),
  );

  if (!config.providers?.claude?.enabled) {
    return { ...base, networkUsages: [], networkUsage: null };
  }

  // agent-store의 real 계정을 runner로 일괄 해결.
  // runner가 0개 반환 시 selectedAccount(= cli-import)를 single profile로 fallback.
  let profiles = await resolveProviderProfiles({
    providerId: CLAUDE_AUTH.storeProvider,
    filterFn: filterClaudeRealAccounts,
    mapFn: claudeMapAccountToProfile,
    accountFilter: options.accountFilter,
    updateLastUsed: false,
  });
  if (profiles.length === 0) {
    const single = resolveClaudeProfileFromSnapshot(base);
    if (single && !options.accountFilter) {
      profiles = [single];
    } else if (single && matchesFilter(single, options.accountFilter)) {
      profiles = [single];
    }
  }
  if (profiles.length === 0) {
    return {
      ...base,
      networkUsages: [],
      networkUsage: null,
      accountFilter: options.accountFilter ?? null,
      filteredOut: Boolean(options.accountFilter),
    };
  }

  // 각 계정에 대해 병렬로 usage 조회. 한 계정이 실패해도 다른 계정은 유지.
  const settled = await Promise.all(
    profiles.map(async (profile) => {
      try {
        const snapshot = await fetchClaudeUsage(profile);
        return { accountKey: profile.id, snapshot };
      } catch (error) {
        return {
          accountKey: profile.id,
          snapshot: createClaudeNetworkFailureSnapshot(profile, error),
        };
      }
    }),
  );

  return {
    ...base,
    networkUsages: settled,
    // backward-compat alias: selectedAccount에 해당하는 항목을 우선 노출,
    // 없으면 첫 항목.
    networkUsage:
      settled.find((s) => s.accountKey === base.selectedAccount?.accountKey)?.snapshot
        ?? settled[0]?.snapshot
        ?? null,
    accountFilter: options.accountFilter ?? null,
    filteredOut: false,
  };
}

// Re-export from shared for backward-compat (tests import from this module).
export { filterProfilesByAccount } from './account-filter.js';

function filterClaudeRealAccounts(accounts) {
  return (accounts ?? []).filter((a) => {
    if (a.status === 'disabled') return false;
    if (a.raw?.mock === true) return false;
    const accessToken = a.tokens?.accessToken ?? a.accessToken ?? null;
    if (!accessToken) return false;
    if (a.source === 'claude-cli-import') return false;
    return true;
  });
}

function claudeMapAccountToProfile(account) {
  return {
    id: account.accountKey,
    accessToken: account.tokens?.accessToken ?? account.accessToken ?? null,
    accountId: account.accountId ?? null,
    email: account.email ?? null,
    label: account.label ?? null,
  };
}

function matchesFilter(profile, accountFilter) {
  if (!accountFilter) return true;
  const needle = String(accountFilter).toLowerCase();
  return (
    (profile.id ?? '').toLowerCase() === needle
    || (profile.email ?? '').toLowerCase() === needle
    || (profile.label ?? '').toLowerCase() === needle
  );
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
 * @deprecated 공통 resolveAuthSource로 대체됨. 기존 테스트 import 호환용.
 */
export function selectClaudeAuthSource(agentAccounts, importedCredential) {
  if (agentAccounts && agentAccounts.length > 0) return 'agent-store';
  if (importedCredential !== null && importedCredential !== undefined) return 'claude-cli-import';
  return 'not-found';
}

/**
 * agent-store에 저장된 Claude 계정 중 live token이 있는 항목만 반환.
 * resolveProviderProfiles의 filterFn과 동일한 기준이지만, 여기서는
 * buildClaudeSnapshot에 agentClaudeAccounts를 넘기기 위해 별도로 로드.
 * (runner와는 달리 profile shape가 아닌 account shape 그대로 반환.)
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

  return filterClaudeRealAccounts(provider.accounts).map((a) => ({
    ...a,
    provider: a.provider ?? 'claude',
    source: a.source ?? 'agent-store',
  }));
}

function createClaudeNetworkFailureSnapshot(profile, error) {
  const message = error instanceof Error ? error.message : String(error);
  return buildUsageSnapshot({
    profile,
    providerId: 'anthropic-claude',
    displayName: 'Claude',
    snapshotIdPrefix: 'claude',
    capturedAt: new Date(),
    responseStatus: null,
    ok: false,
    data: null,
    rawText: message,
    fields: {},
  });
}
