import {
  resolveClaudeCredentialsPath,
  readClaudeCredentials,
} from '@token-weather/provider-adapters/src/claude/read-claude-credentials.js';
import { resolveImportedClaudeSnapshot } from '@token-weather/provider-adapters/src/claude/claude-imported-account.js';
import { resolveClaudeAccount } from '../auth/resolve-claude-account.js';
import { fetchClaudeUsage } from '@token-weather/provider-adapters/src/claude/fetch-claude-usage.js';
import { CLAUDE_AUTH } from '@token-weather/provider-adapters/src/claude/claude-auth-constants.js';
import { loadAuthStore } from '../auth/auth-store.js';
import { buildUsageSnapshot } from '@token-weather/provider-adapters/src/shared/usage-snapshot.js';
import { resolveProviderAccountEntries } from './provider-profile-resolver.js';
import { filterEntriesByAccount } from './account-filter.js';
import { fetchUsageWithAutoRefresh } from './usage-auto-refresh.js';
import { refreshClaudeToken } from '@token-weather/provider-adapters/src/claude/refresh-claude-token.js';
import { updateClaudeStoreAfterRefresh } from '../auth/claude-refresh-store.js';
import {
  filterClaudeRealAccounts,
  claudeMapAccountToProfile,
  matchesFilter,
} from './claude-account-spec.js';

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
  const claudeConfigEnabled = config?.providers?.claude?.enabled ?? false;
  const credentialsPath = resolveClaudeCredentialsPath();

  if (!claudeConfigEnabled) {
    return {
      enabled: false,
      authSource: 'not-found',
      credentialsPath: null,
      usageSnapshots: [],
      accountFilter: options.accountFilter ?? null,
      filteredOut: false,
    };
  }

  const agentClaudeAccounts = await loadAgentStoreClaudeAccounts();
  const base = buildClaudeSnapshot(credentialsPath, readClaudeCredentials, agentClaudeAccounts);

  // Source 선택은 unfiltered 기준으로 먼저 결정 — accountFilter 가 source
  // precedence 를 바꾸지 않게.
  const allAgentEntries = await resolveProviderAccountEntries({
    providerId: CLAUDE_AUTH.storeProvider,
    filterFn: filterClaudeRealAccounts,
    mapFn: claudeMapAccountToProfile,
    accountFilter: null,
    updateLastUsed: false,
  });

  let entries;
  if (allAgentEntries.length > 0) {
    entries = filterEntriesByAccount(allAgentEntries, options.accountFilter);
  } else {
    // cli-import fallback
    const single = resolveClaudeProfileFromSnapshot(base);
    if (single && (!options.accountFilter || matchesFilter(single, options.accountFilter))) {
      entries = [{ account: null, profile: single }];
    } else {
      entries = [];
    }
  }

  const usageSnapshots =
    entries.length === 0
      ? []
      : await Promise.all(
          entries.map(async (entry) => {
            try {
              const result = await fetchUsageWithAutoRefresh(entry, {
                fetchUsage: fetchClaudeUsage,
                refreshToken: refreshClaudeToken,
                updateStoreAfterRefresh: updateClaudeStoreAfterRefresh,
                mapAccountToProfile: claudeMapAccountToProfile,
              });
              return result.snapshot;
            } catch (error) {
              return createClaudeNetworkFailureSnapshot(entry.profile, error);
            }
          }),
        );

  return {
    enabled: true,
    authSource: base.authSource,
    credentialsPath: base.authSource === 'claude-cli-import' ? credentialsPath : null,
    usageSnapshots,
    accountFilter: options.accountFilter ?? null,
    filteredOut: entries.length === 0 && Boolean(options.accountFilter),
  };
}

// Re-export from shared for backward-compat (tests import from this module).
export { filterProfilesByAccount } from './account-filter.js';

// filterClaudeRealAccounts, claudeMapAccountToProfile, matchesFilter
// → imported from claude-account-spec.js

/**
 * Pure: build a Claude credential snapshot.
 * readFn 주입 가능 (테스트 편의).
 * Exported for testing.
 *
 * v0.3.0 (issue #110): `~/.claude/stats-cache.json` 의존 제거 — `usage` 필드
 * 부재. window 사용률은 `networkUsages[]` (network endpoint 결과) 에서만 노출.
 *
 * v0.4.0 (issue #119): backward-compat alias 제거 — `parsed` (== `found`) /
 * `importedAccount` (== `selectedAccount`) 삭제. `--json` shape 정리.
 */
export function buildClaudeSnapshot(
  credentialsPath,
  readFn = readClaudeCredentials,
  agentClaudeAccounts = [],
) {
  const credentials = readFn(credentialsPath);
  const found = credentials !== null;
  const imported = resolveImportedClaudeSnapshot(credentials);
  const { account: selectedAccount, authSource } = resolveClaudeAccount(
    agentClaudeAccounts,
    imported.accounts,
  );
  return {
    detected: found || agentClaudeAccounts.length > 0,
    authSource,
    credentialsPath,
    found,
    selectedAccount,
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
    accountKey: account.accountKey ?? 'claude',
    accessToken,
    accountId: account.accountId ?? null,
    email: account.email ?? null,
    displayName: account.displayName ?? null,
    label: account.label ?? null,
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
