import { decodeJwtPayload } from './token-claims.js';

/**
 * 저장소(`store.providers[providerId].accounts`) 안에서 같은 OAuth subject
 * (sub 또는 email)를 가진 중복 그룹을 찾는다. PR #38 의 `findLegacyDuplicates`
 * 가 "새 계정 vs 기존" 비교라면, 본 함수는 "기존 계정 내부의 그룹화" 라
 * 시그니처가 다르다. 정책(필터 / 우선순위)은 동일하게 맞춤.
 *
 * identity 판별:
 *   1. account.accountId (JWT sub) — 존재하면 최우선
 *   2. account.email — sub 가 없을 때 (단 합성 email `live-*@...` 은 제외)
 *   3. account.raw.idToken 디코드 — 위 둘 다 비어있을 때 fallback
 *
 * 그룹화 기준: 동일 sub OR 동일 email (case-insensitive). transitively 연결된
 * 계정들은 한 그룹으로 합친다 — 예: A(sub1) ↔ B(sub1, email-x) ↔ C(email-x).
 *
 * 필터: source==='manual' 또는 raw.mock===true 인 계정은 그룹화 대상에서 제외.
 *       (수동 paste / 테스트 placeholder 라 자동 정리 대상이 아님)
 *
 * primary 선택 우선순위 (낮을수록 keep):
 *   1. accountId 가 set 된 쪽
 *   2. status !== 'disabled' 인 쪽
 *   3. source === 'agent-store' 인 쪽 (claude-cli-import 등 보다 우선)
 *   4. updatedAt 이 가장 최근 (descending)
 *   5. accountKey lexicographic (안정 정렬)
 *
 * @param {object[]} accounts - store.providers[providerId].accounts 배열
 * @returns {Array<{
 *   reason: 'same-sub' | 'same-email',
 *   identityKey: string,
 *   primary: object,
 *   duplicates: object[]
 * }>}
 */
export function findDuplicateGroups(accounts) {
  if (!Array.isArray(accounts) || accounts.length < 2) return [];

  const eligible = accounts.filter((a) => a && !isManualOrMockAccount(a));
  if (eligible.length < 2) return [];

  // Iterative grouping with merge — 새 계정이 여러 기존 그룹에 매칭되면 그
  // 그룹들을 하나로 병합한다. 매칭이 첫 그룹에서 break 되던 이전 구현은
  // 입력 순서에 따라 bridge 케이스가 누락됐다 (PR #108 review):
  //   A(sub1, email=a) → group [A]
  //   C(sub2, email=b) → group [C]
  //   B(sub1, email=b) → A 그룹에만 합류, C 그룹과 merge 누락 → C 가 단독
  //   잔존 → 길이 1 필터로 사라짐.
  // 새 account 가 매칭되는 모든 그룹을 수집한 뒤 인덱스 0 으로 합쳐 해결.
  // 계정 수가 작아 (<50) O(n²) 충분.
  /** @type {Array<{ accounts: object[] }>} */
  const groups = [];
  for (const account of eligible) {
    const matchedIndices = [];
    for (let i = 0; i < groups.length; i += 1) {
      for (const member of groups[i].accounts) {
        if (sameIdentity(member, account)) {
          matchedIndices.push(i);
          break;
        }
      }
    }

    if (matchedIndices.length === 0) {
      groups.push({ accounts: [account] });
      continue;
    }

    const target = groups[matchedIndices[0]];
    target.accounts.push(account);
    // 두 번째 이후 매칭 그룹들을 target 으로 흡수 후 제거 (descending index 로
    // splice 안전).
    for (let j = matchedIndices.length - 1; j >= 1; j -= 1) {
      const merging = groups[matchedIndices[j]];
      target.accounts.push(...merging.accounts);
      groups.splice(matchedIndices[j], 1);
    }
  }

  return groups
    .filter((g) => g.accounts.length >= 2)
    .map((g) => {
      const reason = determineGroupReason(g.accounts);
      const sorted = [...g.accounts].sort(comparePrimaryPriority);
      const primary = sorted[0];
      const duplicates = sorted.slice(1);
      const identityKey =
        reason === 'same-sub'
          ? (primary.accountId ?? extractIdentity(primary).sub ?? '?')
          : (primary.email ?? extractIdentity(primary).email ?? '?');
      return { reason, identityKey, primary, duplicates };
    });
}

/**
 * 그룹 내부 어떤 페어라도 sub 매칭이면 'same-sub', 아니면 'same-email'.
 * 그룹은 이미 동일 identity 라 보장됐으므로 두 결과 중 하나는 반드시 나옴.
 *
 * @param {object[]} accounts - 동일 그룹 안의 계정들 (length >= 2)
 * @returns {'same-sub' | 'same-email'}
 */
function determineGroupReason(accounts) {
  for (let i = 0; i < accounts.length; i += 1) {
    for (let j = i + 1; j < accounts.length; j += 1) {
      if (sameIdentity(accounts[i], accounts[j]) === 'same-sub') return 'same-sub';
    }
  }
  return 'same-email';
}

/**
 * 두 계정이 같은 identity 인지 판단. 둘 중 하나라도 sub 매칭이면 'same-sub',
 * 아니면 email 매칭 시 'same-email', 그 외 null.
 *
 * @param {object} a
 * @param {object} b
 * @returns {'same-sub'|'same-email'|null}
 */
function sameIdentity(a, b) {
  const ia = extractIdentity(a);
  const ib = extractIdentity(b);
  if (ia.sub && ib.sub && ia.sub === ib.sub) return 'same-sub';
  if (ia.email && ib.email && ia.email.toLowerCase() === ib.email.toLowerCase()) {
    return 'same-email';
  }
  return null;
}

/**
 * 저장된 계정 레코드에서 effective identity 추출.
 * 우선순위: accountId > raw.idToken.sub > null. email 도 동일 폴백.
 * 합성 email (`live-*@...`) 은 매칭 대상에서 제외.
 *
 * @param {object} account
 * @returns {{ sub: string|null, email: string|null }}
 */
function extractIdentity(account) {
  const direct = {
    sub: account.accountId ?? null,
    email: account.email ?? null,
  };
  if (isSyntheticEmail(direct.email)) direct.email = null;
  if (direct.sub || direct.email) {
    // raw.idToken 으로 빈 쪽을 보강 (단 직접값이 있으면 그것 우선)
    const claims = decodeJwtPayload(account.raw?.idToken);
    if (!claims) return direct;
    return {
      sub: direct.sub ?? claims.sub ?? null,
      email: direct.email ?? (isSyntheticEmail(claims.email) ? null : (claims.email ?? null)),
    };
  }

  const claims = decodeJwtPayload(account.raw?.idToken);
  if (!claims) return direct;
  const claimEmail = isSyntheticEmail(claims.email) ? null : (claims.email ?? null);
  return {
    sub: claims.sub ?? null,
    email: claimEmail,
  };
}

function isManualOrMockAccount(account) {
  if (!account) return false;
  if (account.source === 'manual') return true;
  if (account.raw?.mock === true) return true;
  return false;
}

function isSyntheticEmail(email) {
  if (typeof email !== 'string') return false;
  return /^live-[^@]+@/i.test(email);
}

/**
 * primary 선택 정렬 함수. 낮을수록 keep (= primary).
 * 5단 우선순위: accountId 보유 → active → agent-store source → updatedAt 최신 → accountKey.
 *
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function comparePrimaryPriority(a, b) {
  const aHasId = a.accountId ? 0 : 1;
  const bHasId = b.accountId ? 0 : 1;
  if (aHasId !== bHasId) return aHasId - bHasId;

  const aDisabled = a.status === 'disabled' ? 1 : 0;
  const bDisabled = b.status === 'disabled' ? 1 : 0;
  if (aDisabled !== bDisabled) return aDisabled - bDisabled;

  const aSource = a.source === 'agent-store' ? 0 : 1;
  const bSource = b.source === 'agent-store' ? 0 : 1;
  if (aSource !== bSource) return aSource - bSource;

  const aUpdated = typeof a.updatedAt === 'string' ? a.updatedAt : '';
  const bUpdated = typeof b.updatedAt === 'string' ? b.updatedAt : '';
  if (aUpdated !== bUpdated) return bUpdated.localeCompare(aUpdated);

  return (a.accountKey ?? '').localeCompare(b.accountKey ?? '');
}
