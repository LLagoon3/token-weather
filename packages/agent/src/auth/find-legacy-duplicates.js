import { decodeJwtPayload } from './token-claims.js';

/**
 * 새 login이 저장하려는 account(newAccount)와 **같은 identity**(sub 또는 email)를
 * 가지면서 **다른 accountKey**로 이미 저장된 레코드들을 찾는다.
 *
 * identity 판별 우선순위:
 *   1. account.accountId (JWT sub) — 존재하면 최우선
 *   2. account.email — sub가 없으면 fallback
 *   3. account.raw.idToken을 디코드해 얻은 sub / email
 *
 * accountKey가 같은 경우는 upsert로 자연 병합되므로 여기서 제외한다.
 *
 * @param {object[]} existingAccounts - store.providers[...].accounts 배열 (없으면 빈 배열)
 * @param {object} newAccount - 저장 예정 account (accountKey / accountId / email / raw.idToken)
 * @returns {Array<{ accountKey: string, reason: 'same-sub' | 'same-email' }>}
 */
export function findLegacyDuplicates(existingAccounts, newAccount) {
  if (!Array.isArray(existingAccounts) || existingAccounts.length === 0) return [];
  if (!newAccount) return [];

  const newIdentity = extractIdentity(newAccount);
  if (!newIdentity.sub && !newIdentity.email) return [];

  const duplicates = [];
  for (const existing of existingAccounts) {
    if (!existing || existing.accountKey === newAccount.accountKey) continue;
    // manual/mock 계정은 실토큰이 아니라 placeholder 데이터이므로
    // identity가 우연히 일치하더라도 자동 제거 대상에서 제외한다.
    if (isManualOrMockAccount(existing)) continue;
    const existingIdentity = extractIdentity(existing);

    if (
      newIdentity.sub
      && existingIdentity.sub
      && existingIdentity.sub === newIdentity.sub
    ) {
      duplicates.push({ accountKey: existing.accountKey, reason: 'same-sub' });
      continue;
    }

    if (
      newIdentity.email
      && existingIdentity.email
      && existingIdentity.email.toLowerCase() === newIdentity.email.toLowerCase()
    ) {
      duplicates.push({ accountKey: existing.accountKey, reason: 'same-email' });
    }
  }
  return duplicates;
}

function isManualOrMockAccount(account) {
  if (!account) return false;
  if (account.source === 'manual') return true;
  if (account.raw?.mock === true) return true;
  return false;
}

function extractIdentity(account) {
  const direct = {
    sub: account.accountId ?? null,
    email: account.email ?? null,
  };
  if (direct.sub || direct.email) {
    if (isSyntheticEmail(direct.email)) direct.email = null;
    if (direct.sub || direct.email) return direct;
  }

  const claims = decodeJwtPayload(account.raw?.idToken);
  if (!claims) return direct;

  return {
    sub: direct.sub ?? claims.sub ?? null,
    email: direct.email ?? claims.email ?? null,
  };
}

/**
 * extractAccountIdentity가 fallback에서 만드는 합성 이메일(`live-xxxxxxxx@domain`)을
 * 실제 identity로 간주하지 않기 위한 식별자.
 * 직접 비교에는 쓰이지 않지만, 새 account의 email이 합성이면 email 기반
 * 매칭을 배제해야 오인 병합을 피할 수 있다.
 */
function isSyntheticEmail(email) {
  if (typeof email !== 'string') return false;
  return /^live-[^@]+@/i.test(email);
}
