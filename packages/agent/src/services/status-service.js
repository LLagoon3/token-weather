import fs from 'node:fs';
import { createDefaultConfig } from '../config/default-config.js';
import { resolveAgentConfigPath } from '../config/config-path.js';
import { SCHEMA_VERSION } from '../../../schemas/src/index.js';
import { runProviderSnapshots } from './provider-registry.js';

// Provider-specific helpers are imported from provider modules.
// These re-exports keep existing test/CLI import sites working after the split.
export {
  getCodexSnapshot,
  selectCodexAuthSource,
  filterRealCodexAccounts,
} from './codex-provider.js';
export {
  getClaudeSnapshot,
  buildClaudeSnapshot,
  selectClaudeAuthSource,
  resolveClaudeProfileFromSnapshot,
} from './claude-provider.js';

/**
 * Build the top-level status snapshot by loading config and calling every
 * registered provider. New providers go through provider-registry.js, not here.
 */
export async function getStatusSnapshot() {
  const configPath = resolveAgentConfigPath();
  const config = loadConfig(configPath);
  const providerSnapshots = await runProviderSnapshots(config);

  return {
    schemaVersion: SCHEMA_VERSION,
    configPath,
    providers: config.providers,
    sync: config.sync,
    ...providerSnapshots,
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
