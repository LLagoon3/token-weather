import {
  fetchCodexUsage,
  readCodexCliCredentials,
  resolveCodexCliCredentialsPath,
  resolveImportedCodexAccounts,
} from '@token-weather/provider-adapters/src/codex/index.js';
import { filterEntriesByAccount, filterProfilesByAccount } from './account-filter.js';
import { buildUsageSnapshot } from '@token-weather/provider-adapters/src/shared/usage-snapshot.js';
import { resolveAuthSource } from './auth-source-resolver.js';
import { resolveProviderAccountEntries } from './provider-profile-resolver.js';
import { filterRealCodexAccounts, codexMapAccountToProfile } from './codex-account-spec.js';
import { fetchUsageWithAutoRefresh } from './usage-auto-refresh.js';
import { refreshCodexToken } from '@token-weather/provider-adapters/src/codex/index.js';
import { updateCodexStoreAfterRefresh } from '../auth/codex-refresh-store.js';

const CODEX_PROVIDER_ID = 'openai-codex';

/**
 * Build the Codex section of the top-level status snapshot.
 * Reads auth-store first, falls back to Codex CLI credential
 * (`~/.codex/auth.json`) — claude 의 claude-cli-import 폴백과 1:1 대칭.
 *
 * v0.3.0 (issue #113): OpenClaw `auth-profiles.json` 폴백은 `codex-cli-import`
 * 로 교체됨. authSource enum 의 `openclaw-import` 값도 제거됨. `authProfilesPath`
 * 필드는 `credentialsPath` 로 정렬 (claude 와 동일 표면).
 *
 * @param {object} config
 * @returns {Promise<object>}
 */
export async function getCodexSnapshot(config, options = {}) {
  if (!config.providers?.codex?.enabled) {
    return {
      enabled: false,
      credentialsPath: resolveCodexCliCredentialsPath(),
      snapshots: [],
    };
  }

  const { entries, authSource } = await resolveCodexProfiles(options.accountFilter);
  const snapshots = [];

  for (const entry of entries) {
    try {
      snapshots.push(
        (
          await fetchUsageWithAutoRefresh(entry, {
            fetchUsage: fetchCodexUsage,
            refreshToken: refreshCodexToken,
            updateStoreAfterRefresh: updateCodexStoreAfterRefresh,
            mapAccountToProfile: codexMapAccountToProfile,
          })
        ).snapshot,
      );
    } catch (error) {
      snapshots.push(createCodexFailureSnapshot(entry.profile, error));
    }
  }

  return {
    enabled: true,
    authSource,
    credentialsPath: authSource === 'codex-cli-import' ? resolveCodexCliCredentialsPath() : null,
    snapshots,
    accountFilter: options.accountFilter ?? null,
    filteredOut: Boolean(options.accountFilter) && entries.length === 0,
  };
}

// Re-export from shared for backward-compat (tests import from this module).
export { filterProfilesByAccount } from './account-filter.js';

/**
 * @deprecated 공통 resolveAuthSource로 대체됨. 기존 테스트 import 호환용 re-export.
 */
export function selectCodexAuthSource(agentProfiles, importedProfiles) {
  const { accounts, authSource } = resolveAuthSource(agentProfiles, [
    { id: 'codex-cli-import', accounts: importedProfiles },
  ]);
  return { profiles: accounts, authSource };
}

// Re-export for backward compat (tests/status-service import from here).
export { filterRealCodexAccounts } from './codex-account-spec.js';

async function resolveCodexProfiles(accountFilter) {
  // Source 선택은 unfiltered 기준으로 먼저 결정한다.
  // accountFilter가 source precedence를 바꿔서는 안 된다.
  const allAgentEntries = await resolveProviderAccountEntries({
    providerId: CODEX_PROVIDER_ID,
    filterFn: filterRealCodexAccounts,
    mapFn: codexMapAccountToProfile,
    accountFilter: null, // 필터 없이 전체 real 프로필 로드
  });

  if (allAgentEntries.length > 0) {
    const filteredEntries = filterEntriesByAccount(allAgentEntries, accountFilter);
    return { entries: filteredEntries, authSource: 'agent-store' };
  }

  // Fallback: Codex CLI 자체 credential (~/.codex/auth.json) — claude-cli-import 와 대칭.
  const tokens = readCodexCliCredentials();
  const importedAccounts = resolveImportedCodexAccounts(tokens);
  const filtered = filterProfilesByAccount(importedAccounts, accountFilter);
  const { accounts, authSource } = resolveAuthSource(
    [],
    [{ id: 'codex-cli-import', accounts: filtered }],
  );
  return {
    entries: accounts.map((profile) => ({ account: null, profile })),
    authSource,
  };
}

// codexMapAccountToProfile imported from codex-account-spec.js

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
