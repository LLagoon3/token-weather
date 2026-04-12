import fs from 'node:fs';
import { createDefaultConfig } from '../config/default-config.js';
import { resolveAgentConfigPath } from '../config/config-path.js';
import { fetchCodexUsage, getDefaultAuthProfilesPath, readCodexAuthProfiles } from '../../../provider-adapters/src/codex/index.js';

export async function getStatusSnapshot() {
  const configPath = resolveAgentConfigPath();
  const config = loadConfig(configPath);
  const codex = await getCodexSnapshot(config);

  return {
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
      profiles: []
    };
  }

  const profiles = readCodexAuthProfiles();
  const usageResults = [];

  for (const profile of profiles) {
    try {
      usageResults.push(await fetchCodexUsage(profile));
    } catch (error) {
      usageResults.push({
        profileId: profile.id,
        email: profile.email,
        ok: false,
        status: null,
        plan: null,
        creditsBalance: null,
        windows: { primary: null, secondary: null },
        rawError: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    enabled: true,
    authProfilesPath: getDefaultAuthProfilesPath(),
    profiles: usageResults
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
