import {
  fetchCodexUsage,
  getDefaultAuthProfilesPath,
  readCodexAuthProfiles,
} from '../../../provider-adapters/src/codex/index.js';
import { SCHEMA_VERSION } from '../../../schemas/src/index.js';
import { loadAuthStore, saveAuthStore, upsertProviderAccount } from '../auth/auth-store.js';
import { resolveDefaultAccount } from '../auth/account-resolver.js';

const CODEX_PROVIDER_ID = 'openai-codex';

/**
 * Build the Codex section of the top-level status snapshot.
 * Reads auth-store first, falls back to OpenClaw auth-profiles.
 *
 * @param {object} config
 * @returns {Promise<object>}
 */
export async function getCodexSnapshot(config) {
  if (!config.providers?.codex?.enabled) {
    return {
      enabled: false,
      authProfilesPath: getDefaultAuthProfilesPath(),
      snapshots: [],
    };
  }

  const { profiles, authSource } = await resolveCodexProfiles();
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
  };
}

/**
 * Pure selection: agent-store > openclaw-import.
 * Exported for testing.
 */
export function selectCodexAuthSource(agentProfiles, openclawProfiles) {
  if (agentProfiles.length > 0) {
    return { profiles: agentProfiles, authSource: 'agent-store' };
  }
  return { profiles: openclawProfiles, authSource: 'openclaw-import' };
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

async function resolveCodexProfiles() {
  const agentProfiles = await getAgentStoreProfiles();
  const openclawProfiles = agentProfiles.length === 0 ? readCodexAuthProfiles() : [];
  return selectCodexAuthSource(agentProfiles, openclawProfiles);
}

async function getAgentStoreProfiles() {
  let store;
  try {
    store = await loadAuthStore();
  } catch {
    return [];
  }

  const providerData = store.providers?.[CODEX_PROVIDER_ID];
  if (!providerData?.accounts?.length) return [];

  const realAccounts = filterRealCodexAccounts(providerData.accounts);
  if (realAccounts.length === 0) return [];

  const { account } = resolveDefaultAccount(realAccounts);
  if (!account) return [];

  // Keep multi-account selection stable across runs.
  try {
    const freshStore = await loadAuthStore();
    const updatedAccount = { ...account, lastUsedAt: new Date().toISOString() };
    const nextStore = upsertProviderAccount(freshStore, CODEX_PROVIDER_ID, updatedAccount);
    await saveAuthStore(nextStore);
  } catch {
    // best-effort
  }

  return [mapAccountToProfile(account)];
}

function mapAccountToProfile(account) {
  return {
    id: account.accountKey,
    accessToken: account.tokens.accessToken,
    accountId: account.accountId ?? null,
    email: account.email ?? null,
    expires: account.expiresAt ?? null,
  };
}

function createCodexFailureSnapshot(profile, error) {
  const capturedAt = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  return {
    schemaVersion: SCHEMA_VERSION,
    snapshotId: `codex:${profile.id}:${capturedAt}`,
    capturedAt,
    provider: { id: 'openai-codex', displayName: 'Codex', region: null },
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
    raw: { provider: 'openai-codex', rawError: message },
  };
}
