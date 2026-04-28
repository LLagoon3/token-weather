import path from 'node:path';
import os from 'node:os';

export function resolveAgentConfigDir() {
  return path.join(os.homedir(), '.config', 'token-weather');
}

export function resolveAgentConfigPath() {
  return path.join(resolveAgentConfigDir(), 'config.json');
}
