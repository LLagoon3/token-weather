/**
 * `doctor codex --dedupe` / `doctor claude --dedupe` 명령의 흐름 (issue #37).
 *
 * 동작:
 *  - dry-run (default): 중복 그룹 + backfill 후보를 콘솔에 출력만, store 변경 없음
 *  - apply (`--apply`): 변경 사항을 실제 store 에 반영 + saveAuthStore
 *
 * 옵션 조합:
 *  - `--dedupe`             : 중복 그룹만 dry-run
 *  - `--dedupe --apply`     : 중복 제거 실제 반영
 *  - `--dedupe --backfill-account-id`         : backfill 후보까지 dry-run
 *  - `--dedupe --backfill-account-id --apply` : 둘 다 실제 반영
 *
 * I/O 와 순수 로직을 분리:
 *  - buildDedupePlan : 순수 함수 (accounts → plan)
 *  - applyDedupePlan : 순수 함수 (store + plan → next store)
 *  - runDedupeFlow   : I/O wrapper (load / console / save)
 */
import {
  loadAuthStore,
  saveAuthStore,
  removeProviderAccount,
  updateProviderAccount,
} from '../auth/auth-store.js';
import { findDuplicateGroups } from '../auth/find-duplicate-groups.js';
import { decodeJwtPayload } from '../auth/token-claims.js';
import {
  formatDedupeProposal,
  formatDedupeApplied,
  formatDedupeNoChanges,
} from './doctor-dedupe-formatters.js';

/**
 * @typedef {object} DedupePlan
 * @property {ReturnType<typeof findDuplicateGroups>} groups
 * @property {Array<{ accountKey: string, sub: string }>} backfillCandidates
 */

/**
 * accountId 가 빈 레코드 중 raw.idToken 에 sub 가 있어 backfill 가능한 후보를 추린다.
 *
 * @param {object[]} accounts
 * @returns {Array<{ accountKey: string, sub: string }>}
 */
export function findBackfillCandidates(accounts) {
  if (!Array.isArray(accounts)) return [];
  const out = [];
  for (const account of accounts) {
    if (!account || account.accountId) continue;
    if (!account.raw?.idToken) continue;
    const payload = decodeJwtPayload(account.raw.idToken);
    if (!payload?.sub) continue;
    out.push({ accountKey: account.accountKey, sub: payload.sub });
  }
  return out;
}

/**
 * 순수 함수: accounts + options 로 dedupe plan 을 계산.
 *
 * @param {{ accounts: object[], options: { backfillAccountId?: boolean } }} params
 * @returns {DedupePlan}
 */
export function buildDedupePlan({ accounts, options }) {
  const groups = findDuplicateGroups(accounts);
  const backfillCandidates = options.backfillAccountId ? findBackfillCandidates(accounts) : [];
  return { groups, backfillCandidates };
}

/**
 * 순수 함수: store + plan → next store. 변경 없으면 원본 그대로 반환.
 *
 * @param {object} store
 * @param {string} providerId
 * @param {DedupePlan} plan
 * @returns {object}
 */
export function applyDedupePlan(store, providerId, plan) {
  let next = store;
  for (const group of plan.groups) {
    for (const dup of group.duplicates) {
      next = removeProviderAccount(next, providerId, dup.accountKey);
    }
  }
  for (const candidate of plan.backfillCandidates) {
    next = updateProviderAccount(next, providerId, candidate.accountKey, {
      accountId: candidate.sub,
    });
  }
  return next;
}

/**
 * doctor --dedupe 흐름의 entry point. console 출력 + 옵션에 따라 saveAuthStore.
 *
 * @param {{
 *   providerId: 'openai-codex' | 'claude',
 *   options: { dedupe: boolean, apply: boolean, backfillAccountId: boolean, account?: string|null }
 * }} params
 */
export async function runDedupeFlow({ providerId, options }) {
  if (options.account) {
    console.log('ℹ --account 옵션은 --dedupe 모드에서 무시됩니다 (모든 계정을 대상으로 검사).');
    console.log('');
  }

  const store = await loadAuthStore();
  const accounts = store.providers?.[providerId]?.accounts ?? [];
  const plan = buildDedupePlan({ accounts, options });

  for (const line of formatDedupeProposal({ providerId, accounts, plan, options })) {
    console.log(line);
  }

  if (!options.apply) return;

  if (plan.groups.length === 0 && plan.backfillCandidates.length === 0) {
    for (const line of formatDedupeNoChanges()) console.log(line);
    return;
  }

  const nextStore = applyDedupePlan(store, providerId, plan);
  await saveAuthStore(nextStore);

  for (const line of formatDedupeApplied(plan)) {
    console.log(line);
  }
}
