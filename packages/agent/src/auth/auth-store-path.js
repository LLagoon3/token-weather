import path from 'node:path';
import os from 'node:os';

const AUTH_STORE_FILENAME = 'auth.json';

export function resolveAuthStoreDir() {
  return path.join(os.homedir(), '.config', 'ai-usage-agent');
}

export function resolveAuthStorePath() {
  return path.join(resolveAuthStoreDir(), AUTH_STORE_FILENAME);
}
