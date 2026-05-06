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
      `Unsupported auth store version: ${store.version} (expected ${AUTH_STORE_VERSION})`,
    );
  }

  return store;
}

export async function saveAuthStore(store) {
  const dir = resolveAuthStoreDir();
  await fs.mkdir(dir, { recursive: true });

  const filePath = resolveAuthStorePath();
  const data = JSON.stringify({ ...store, updatedAt: new Date().toISOString() }, null, 2);

  await fs.writeFile(filePath, data + '\n', { mode: FILE_MODE });
}

export function upsertProviderAccount(store, providerId, account) {
  const nextStore = structuredClone(store);

  if (!nextStore.providers[providerId]) {
    nextStore.providers[providerId] = { accounts: [] };
  }

  const accounts = nextStore.providers[providerId].accounts;
  const index = accounts.findIndex((item) => item.accountKey === account.accountKey);

  if (index >= 0) {
    accounts[index] = {
      ...accounts[index],
      ...account,
      updatedAt: new Date().toISOString(),
    };
  } else {
    accounts.push(account);
  }

  return nextStore;
}

export function removeProviderAccount(store, providerId, accountKey) {
  const nextStore = structuredClone(store);

  const provider = nextStore.providers?.[providerId];
  if (!provider || !provider.accounts) {
    return nextStore;
  }

  provider.accounts = provider.accounts.filter((a) => a.accountKey !== accountKey);

  return nextStore;
}

/**
 * 특정 accountKey 의 레코드를 partial patch 로 갱신한다.
 * 매칭되는 레코드가 없으면 원본 store 를 그대로 반환 (no-op).
 *
 * upsertProviderAccount 와 차이:
 *   - upsert 는 "신규 또는 전체 갱신" — 없으면 push, 있으면 spread merge.
 *   - update 는 "있을 때만 부분 갱신" — 없으면 noop, 있으면 spread merge.
 *
 * 주 용도: doctor --dedupe --backfill-account-id 가 accountId 만 채울 때.
 *
 * @param {object} store
 * @param {string} providerId
 * @param {string} accountKey
 * @param {object} patch - 병합할 부분 필드들
 * @returns {object} 새 store (원본 불변)
 */
export function updateProviderAccount(store, providerId, accountKey, patch) {
  const nextStore = structuredClone(store);

  const provider = nextStore.providers?.[providerId];
  if (!provider || !provider.accounts) return nextStore;

  const index = provider.accounts.findIndex((a) => a.accountKey === accountKey);
  if (index < 0) return nextStore;

  provider.accounts[index] = {
    ...provider.accounts[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  return nextStore;
}
