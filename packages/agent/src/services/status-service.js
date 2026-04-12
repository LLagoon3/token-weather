import fs from 'node:fs';
import { createDefaultConfig } from '../config/default-config.js';
import { resolveAgentConfigPath } from '../config/config-path.js';

export async function getStatusSnapshot() {
  const configPath = resolveAgentConfigPath();
  const config = loadConfig(configPath);

  return {
    configPath,
    providers: config.providers,
    sync: config.sync
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
