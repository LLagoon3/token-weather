/**
 * Provider-중립 account filter.
 *
 * profile 객체의 id(accountKey) / email / label 중 하나가 accountFilter와
 * case-insensitive로 일치하면 포함. filter가 falsy이면 전체 반환.
 *
 * @template T
 * @param {T[]} profiles
 * @param {string|null|undefined} accountFilter
 * @returns {T[]}
 */
export function filterProfilesByAccount(profiles, accountFilter) {
  if (!accountFilter) return profiles;
  const needle = String(accountFilter).toLowerCase();
  return profiles.filter(
    (p) =>
      (p.id ?? '').toLowerCase() === needle
      || (p.email ?? '').toLowerCase() === needle
      || (p.label ?? '').toLowerCase() === needle,
  );
}
