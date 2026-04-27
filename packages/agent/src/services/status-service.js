import fs from 'node:fs';
import { createDefaultConfig } from '../config/default-config.js';
import { resolveAgentConfigPath } from '../config/config-path.js';
import { SCHEMA_VERSION } from '@token-weather/schemas/src/index.js';
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
 * @typedef {object} StatusSnapshot
 * @property {string} schemaVersion - `@token-weather/schemas`의 SCHEMA_VERSION 통과값.
 * @property {string} configPath - resolved config 파일 경로.
 * @property {object} providers - config.providers (provider별 enabled flag).
 * @property {object} sync - config.sync.
 * @property {string|null} accountFilter - `--account <id>` 입력 (case-insensitive 매칭은 별도).
 * @property {string|null} providerFilter - `--provider <id>` 입력 (lowercase 정규화된 값).
 * @property {object} [codex] - Codex provider snapshot (providerFilter가 codex만 지정 시 codex만 존재).
 * @property {object} [claude] - Claude provider snapshot (동일 규칙).
 */

/**
 * Build the top-level status snapshot by loading config and calling every
 * registered provider. New providers go through provider-registry.js, not here.
 *
 * @param {{ accountFilter?: string, providerFilter?: string }} [options]
 *   `providerFilter`가 지정되면 해당 provider 한 곳의 snapshot만 포함된다.
 * @returns {Promise<StatusSnapshot>}
 */
export async function getStatusSnapshot(options = {}) {
  const configPath = resolveAgentConfigPath();
  const config = loadConfig(configPath);
  const providerSnapshots = await runProviderSnapshots(config, options);

  return {
    schemaVersion: SCHEMA_VERSION,
    configPath,
    providers: config.providers,
    sync: config.sync,
    accountFilter: options.accountFilter ?? null,
    providerFilter: options.providerFilter ?? null,
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
