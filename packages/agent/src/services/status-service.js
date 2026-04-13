import fs from 'node:fs';
import { createDefaultConfig } from '../config/default-config.js';
import { resolveAgentConfigPath } from '../config/config-path.js';
import { fetchCodexUsage, getDefaultAuthProfilesPath, readCodexAuthProfiles } from '../../../provider-adapters/src/codex/index.js';
import { SCHEMA_VERSION } from '../../../schemas/src/index.js';

export async function getStatusSnapshot() {
  const configPath = resolveAgentConfigPath();
  const config = loadConfig(configPath);
  const codex = await getCodexSnapshot(config);

  return {
    schemaVersion: SCHEMA_VERSION,
    configPath,
    providers: config.providers,
    sync: config.sync,
    codex
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

  const profiles = readCodexAuthProfiles();
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
    authProfilesPath: getDefaultAuthProfilesPath(),
    snapshots
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
