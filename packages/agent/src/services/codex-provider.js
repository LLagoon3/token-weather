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
      authSource: 'not-found',
      // claude 와 동일 정책 — credentialsPath 는 'codex-cli-import' 시점만 노출.
      // disabled 또는 not-found 시 null (PR #123 review 정정).
      credentialsPath: null,
      usageSnapshots: [],
      accountFilter: options.accountFilter ?? null,
      filteredOut: false,
    };
  }

  const { entries, authSource } = await resolveCodexProfiles(options.accountFilter);
  const usageSnapshots = [];

  for (const entry of entries) {
    try {
      usageSnapshots.push(
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
      usageSnapshots.push(createCodexFailureSnapshot(entry.profile, error));
    }
  }

  return {
    enabled: true,
    authSource,
    credentialsPath: authSource === 'codex-cli-import' ? resolveCodexCliCredentialsPath() : null,
    usageSnapshots,
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
  // imported account 는 fetchCodexUsage / buildUsageSnapshot 호환 profile shape 으로
  // normalize 한 뒤 filter 에 넘긴다 — claude 측 resolveClaudeProfileFromSnapshot 과 대칭.
  // (account record 의 accountKey 만으로는 filterProfilesByAccount(id/email/label)
  // 매칭이 안 되고, buildUsageSnapshot 의 profile.id 도 비기 때문.)
  const tokens = readCodexCliCredentials();
  const importedAccounts = resolveImportedCodexAccounts(tokens);
  const importedProfiles = importedAccounts
    .map((account) => resolveCodexProfileFromAccount(account))
    .filter(Boolean);
  const filtered = filterProfilesByAccount(importedProfiles, accountFilter);
  const { accounts, authSource } = resolveAuthSource(
    [],
    [{ id: 'codex-cli-import', accounts: filtered }],
  );
  return {
    entries: accounts.map((profile) => ({ account: null, profile })),
    authSource,
  };
}

/**
 * Imported Codex account record → fetchCodexUsage 호환 profile shape.
 * claude 측의 `resolveClaudeProfileFromSnapshot` 와 1:1 대칭.
 *
 * imported account (top-level accessToken) 와 agent-store account (tokens.accessToken)
 * 두 shape 모두 허용. accessToken 부재 시 `null`.
 *
 * Exported for testing.
 *
 * @param {object|null} account
 * @returns {object|null}
 */
export function resolveCodexProfileFromAccount(account) {
  if (!account) return null;

  const accessToken = account.accessToken ?? account.tokens?.accessToken ?? null;
  if (!accessToken) return null;

  return {
    id: account.accountKey ?? 'codex',
    accountKey: account.accountKey ?? 'codex',
    accessToken,
    accountId: account.accountId ?? null,
    email: account.email ?? null,
    label: account.label ?? null,
    expires: account.expiresAt ?? null,
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
