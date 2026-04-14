import fs from 'node:fs';
import { createDefaultConfig } from '../config/default-config.js';
import { resolveAgentConfigPath } from '../config/config-path.js';
import { fetchCodexUsage, getDefaultAuthProfilesPath, readCodexAuthProfiles } from '../../../provider-adapters/src/codex/index.js';
import { resolveClaudeCredentialsPath, readClaudeCredentials } from '../../../provider-adapters/src/claude/read-claude-credentials.js';
import { resolveImportedClaudeSnapshot } from '../../../provider-adapters/src/claude/resolve-imported-claude-snapshot.js';
import { resolveClaudeAccount } from '../auth/resolve-claude-account.js';
import { SCHEMA_VERSION } from '../../../schemas/src/index.js';
import { loadAuthStore, saveAuthStore, upsertProviderAccount } from '../auth/auth-store.js';
import { resolveDefaultAccount } from '../auth/account-resolver.js';

const CODEX_PROVIDER_ID = 'openai-codex';

export async function getStatusSnapshot() {
  const configPath = resolveAgentConfigPath();
  const config = loadConfig(configPath);
  const codex = await getCodexSnapshot(config);
  const claude = buildClaudeSnapshot(resolveClaudeCredentialsPath());

  return {
    schemaVersion: SCHEMA_VERSION,
    configPath,
    providers: config.providers,
    sync: config.sync,
    codex,
    claude,
  };
}

/**
 * Exported for testing: select the effective Claude auth source.
 *
 * Priority: agent-store > claude-cli-import > not-found
 *
 * @param {Array} agentAccounts - Claude accounts from agent-store (may be empty)
 * @param {object|null} importedCredential - parsed credential from Claude CLI, or null
 * @returns {'agent-store' | 'claude-cli-import' | 'not-found'}
 */
export function selectClaudeAuthSource(agentAccounts, importedCredential) {
  if (agentAccounts && agentAccounts.length > 0) {
    return 'agent-store';
  }
  if (importedCredential !== null && importedCredential !== undefined) {
    return 'claude-cli-import';
  }
  return 'not-found';
}

/**
 * Exported for testing: build a Claude credential status snapshot.
 * readFn is injectable so tests don't touch the filesystem.
 * agentClaudeAccounts is the list of Claude accounts from the agent-store
 * (currently always empty until Claude login is implemented).
 */
export function buildClaudeSnapshot(credentialsPath, readFn = readClaudeCredentials, agentClaudeAccounts = []) {
  const credentials = readFn(credentialsPath);
  const found = credentials !== null;
  const imported = resolveImportedClaudeSnapshot(credentials);
  const { account: selectedAccount, authSource } = resolveClaudeAccount(agentClaudeAccounts, imported.accounts);
  return {
    detected: found || agentClaudeAccounts.length > 0,
    authSource,
    credentialsPath,
    found,
    parsed: found,
    selectedAccount,
    importedAccount: selectedAccount, // backward-compat alias — prefer selectedAccount
  };
}

async function getCodexSnapshot(config) {
  if (!config.providers?.codex?.enabled) {
    return {
      enabled: false,
      authProfilesPath: getDefaultAuthProfilesPath(),
      snapshots: []
    };
  }

  // Auth source priority: agent-store (real tokens) > openclaw-import (fallback)
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
    snapshots
  };
}

/**
 * Resolve Codex profiles with priority: agent-store > openclaw-import.
 *
 * Agent-store accounts with real tokens (non-mock) are preferred.
 * Falls back to OpenClaw auth-profiles.json if no real agent-store accounts exist.
 */
async function resolveCodexProfiles() {
  // 1. Try agent-store first
  const agentProfiles = await getAgentStoreProfiles();

  // 2. Fallback: OpenClaw auth-profiles.json
  const openclawProfiles = agentProfiles.length === 0 ? readCodexAuthProfiles() : [];
  return selectCodexAuthSource(agentProfiles, openclawProfiles);
}

/**
 * Exported for testing: given pre-resolved profile lists, return the active
 * source and its profiles. No I/O — pure selection logic.
 */
export function selectCodexAuthSource(agentProfiles, openclawProfiles) {
  if (agentProfiles.length > 0) {
    return { profiles: agentProfiles, authSource: 'agent-store' };
  }
  return { profiles: openclawProfiles, authSource: 'openclaw-import' };
}

/**
 * Exported for testing: filter an accounts array down to real (non-mock) active
 * accounts. No I/O — pure predicate logic.
 */
export function filterRealCodexAccounts(accounts) {
  return (accounts ?? []).filter(
    (a) => a.status !== 'disabled'
      && a.tokens?.accessToken
      && !a.raw?.mock
      && !a.tokens.accessToken.startsWith('mock-')
  );
}

/**
 * Load real (non-mock) Codex accounts from agent auth store and
 * convert them to the profile format fetchCodexUsage() expects.
 */
async function getAgentStoreProfiles() {
  let store;
  try {
    store = await loadAuthStore();
  } catch {
    return [];
  }

  const providerData = store.providers?.[CODEX_PROVIDER_ID];
  if (!providerData?.accounts?.length) {
    return [];
  }

  // Filter: active accounts with real tokens (exclude mock accounts)
  const realAccounts = filterRealCodexAccounts(providerData.accounts);

  if (realAccounts.length === 0) {
    return [];
  }

  // Use account resolver to pick best account(s)
  const { account } = resolveDefaultAccount(realAccounts);
  if (!account) {
    return [];
  }

  // Update lastUsedAt so multi-account selection stays stable
  try {
    const freshStore = await loadAuthStore();
    const updatedAccount = { ...account, lastUsedAt: new Date().toISOString() };
    const nextStore = upsertProviderAccount(freshStore, CODEX_PROVIDER_ID, updatedAccount);
    await saveAuthStore(nextStore);
  } catch {
    // best-effort — don't block usage fetch if lastUsedAt update fails
  }

  // Map agent-store account to the profile format fetchCodexUsage expects
  return [mapAccountToProfile(account)];
}

/**
 * Convert an agent-store account object to the profile shape
 * that fetchCodexUsage() expects: { id, accessToken, accountId, email, expires }
 */
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
    provider: {
      id: 'openai-codex',
      displayName: 'Codex',
      region: null
    },
    account: {
      profileId: profile.id,
      accountId: profile.accountId ?? null,
      email: profile.email ?? null,
      plan: null
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
      lastFailureAt: capturedAt
    },
    usageWindows: [],
    credits: {
      balance: null,
      unit: null
    },
    raw: {
      provider: 'openai-codex',
      rawError: message
    }
  };
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return createDefaultConfig();
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return createDefaultConfig();
  }
}
