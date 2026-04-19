import { loadAuthStore, saveAuthStore, upsertProviderAccount } from '../auth/auth-store.js';
import { resolveDefaultAccount } from '../auth/account-resolver.js';
import { filterProfilesByAccount } from './account-filter.js';

/**
 * 공통 provider profile resolver.
 *
 * "store 로드 → real 계정 필터 → profile 매핑 → accountFilter 적용
 *  → lastUsedAt 갱신" 흐름을 한 곳에서 처리한다.
 *
 * provider별 차이는 spec 객체로 주입:
 *   - providerId:  store.providers[providerId]
 *   - filterFn:    (accounts) => real accounts (mock/disabled 제거)
 *   - mapFn:       (account) => profile shape (fetchXxxUsage가 받는 형태)
 *   - updateLastUsed: true면 기본 선택 계정에 lastUsedAt 갱신
 *
 * @param {{
 *   providerId: string,
 *   filterFn: (accounts: object[]) => object[],
 *   mapFn: (account: object) => object,
 *   accountFilter?: string|null,
 *   updateLastUsed?: boolean,
 * }} spec
 * @returns {Promise<object[]>} - fetch에 넘길 profile 배열
 */
export async function resolveProviderProfiles(spec) {
  let store;
  try {
    store = await loadAuthStore();
  } catch {
    return [];
  }

  const providerData = store.providers?.[spec.providerId];
  if (!providerData?.accounts?.length) return [];

  const realAccounts = spec.filterFn(providerData.accounts);
  if (realAccounts.length === 0) return [];

  // lastUsedAt 갱신: 기본 선택 계정에 대해서만 (multi-account 자동 선택 안정화).
  if (spec.updateLastUsed !== false) {
    try {
      const { account: defaultAccount } = resolveDefaultAccount(realAccounts);
      if (defaultAccount) {
        const freshStore = await loadAuthStore();
        const updatedAccount = { ...defaultAccount, lastUsedAt: new Date().toISOString() };
        const nextStore = upsertProviderAccount(freshStore, spec.providerId, updatedAccount);
        await saveAuthStore(nextStore);
      }
    } catch {
      // best-effort
    }
  }

  const profiles = realAccounts.map(spec.mapFn);
  return filterProfilesByAccount(profiles, spec.accountFilter ?? null);
}
