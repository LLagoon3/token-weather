import {
  fetchCodexUsage,
  getDefaultAuthProfilesPath,
  readCodexAuthProfiles,
} from '../../../provider-adapters/src/codex/index.js';
import { filterProfilesByAccount } from './account-filter.js';
import { buildUsageSnapshot } from '../../../provider-adapters/src/shared/usage-snapshot.js';
import { resolveAuthSource } from './auth-source-resolver.js';
import { resolveProviderProfiles } from './provider-profile-resolver.js';

const CODEX_PROVIDER_ID = 'openai-codex';

/**
 * Build the Codex section of the top-level status snapshot.
 * Reads auth-store first, falls back to OpenClaw auth-profiles.
 *
 * @param {object} config
 * @returns {Promise<object>}
 */
export async function getCodexSnapshot(config, options = {}) {
  if (!config.providers?.codex?.enabled) {
    return {
      enabled: false,
      authProfilesPath: getDefaultAuthProfilesPath(),
      snapshots: [],
    };
  }

  const { profiles, authSource } = await resolveCodexProfiles(options.accountFilter);
  const snapshots = [];

  for (const profile of profiles) {
    try {
      snapshots.push(await fetchCodexUsage(profile));
    } catch (error) {
      snapshots.push(createCodexFailureSnapshot(profile, error));
    }
  }

  return {
    enabled: true,
    authSource,
    authProfilesPath: authSource === 'openclaw-import' ? getDefaultAuthProfilesPath() : null,
    snapshots,
    accountFilter: options.accountFilter ?? null,
    filteredOut: Boolean(options.accountFilter) && profiles.length === 0,
  };
}

// Re-export from shared for backward-compat (tests import from this module).
export { filterProfilesByAccount } from './account-filter.js';

/**
 * @deprecated 공통 resolveAuthSource로 대체됨. 기존 테스트 import 호환용 re-export.
 */
export function selectCodexAuthSource(agentProfiles, openclawProfiles) {
  const { accounts, authSource } = resolveAuthSource(agentProfiles, [
    { id: 'openclaw-import', accounts: openclawProfiles },
  ]);
  return { profiles: accounts, authSource };
}

/**
 * Pure predicate: keep active, non-mock accounts with a usable access token.
 * Exported for testing.
 */
export function filterRealCodexAccounts(accounts) {
  return (accounts ?? []).filter(
    (a) => a.status !== 'disabled'
      && a.tokens?.accessToken
      && !a.raw?.mock
      && !a.tokens.accessToken.startsWith('mock-'),
  );
}

async function resolveCodexProfiles(accountFilter) {
  // Source 선택은 unfiltered 기준으로 먼저 결정한다.
  // accountFilter가 source precedence를 바꿔서는 안 된다.
  const allAgentProfiles = await resolveProviderProfiles({
    providerId: CODEX_PROVIDER_ID,
    filterFn: filterRealCodexAccounts,
    mapFn: codexMapAccountToProfile,
    accountFilter: null, // 필터 없이 전체 real 프로필 로드
  });

  if (allAgentProfiles.length > 0) {
    // agent-store 확정. 그 위에서 accountFilter 적용.
    const filtered = filterProfilesByAccount(allAgentProfiles, accountFilter);
    return { profiles: filtered, authSource: 'agent-store' };
  }

  // Fallback: OpenClaw import
  const openclawProfiles = readCodexAuthProfiles();
  const filtered = filterProfilesByAccount(openclawProfiles, accountFilter);
  const { accounts, authSource } = resolveAuthSource([], [
    { id: 'openclaw-import', accounts: filtered },
  ]);
  return { profiles: accounts, authSource };
}

function codexMapAccountToProfile(account) {
  return {
    id: account.accountKey,
    accessToken: account.tokens.accessToken,
    accountId: account.accountId ?? null,
    email: account.email ?? null,
    label: account.label ?? null,
    expires: account.expiresAt ?? null,
  };
}

function createCodexFailureSnapshot(profile, error) {
  const message = error instanceof Error ? error.message : String(error);
  return buildUsageSnapshot({
    profile,
    providerId: 'openai-codex',
    displayName: 'Codex',
    snapshotIdPrefix: 'codex',
    capturedAt: new Date(),
    responseStatus: null,
    ok: false,
    data: null,
    rawText: message,
    fields: {},
  });
}
