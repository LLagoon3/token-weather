import fs from 'node:fs/promises';
import { resolveAuthStoreDir, resolveAuthStorePath } from './auth-store-path.js';
import { createEmptyAuthStore, AUTH_STORE_VERSION } from './auth-store-schema.js';

const FILE_MODE = 0o600;

export async function loadAuthStore() {
  const filePath = resolveAuthStorePath();

  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return createEmptyAuthStore();
    }
    throw err;
  }

  const store = JSON.parse(raw);

  if (store.version !== AUTH_STORE_VERSION) {
    throw new Error(
      `Unsupported auth store version: ${store.version} (expected ${AUTH_STORE_VERSION})`
    );
  }

  return store;
}

export async function saveAuthStore(store) {
  const dir = resolveAuthStoreDir();
  await fs.mkdir(dir, { recursive: true });

  const filePath = resolveAuthStorePath();
  const data = JSON.stringify(
    { ...store, updatedAt: new Date().toISOString() },
    null,
    2
  );

  await fs.writeFile(filePath, data + '\n', { mode: FILE_MODE });
}
