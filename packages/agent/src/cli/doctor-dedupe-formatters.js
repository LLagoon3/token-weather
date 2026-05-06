/**
 * doctor --dedupe 의 출력 문자열 빌더. 모두 `string[]` 반환 (console.log 호출 X).
 *
 * 입력 plan 은 doctor-dedupe-flow.js 의 buildDedupePlan 결과.
 */

/**
 * dry-run / pre-apply 모두에서 호출 — 발견 결과 공통 출력.
 *
 * @param {{
 *   providerId: string,
 *   accounts: object[],
 *   plan: { groups: any[], backfillCandidates: any[] },
 *   options: { apply?: boolean, backfillAccountId?: boolean }
 * }} params
 * @returns {string[]}
 */
export function formatDedupeProposal({ providerId, accounts, plan, options }) {
  const lines = [];
  const providerLabel = providerLabelFor(providerId);
  lines.push(`${providerLabel} 계정 dedupe 검사`);
  lines.push('-'.repeat(40));
  lines.push(`저장된 ${providerLabel} 계정: ${accounts.length}`);
  lines.push('');

  if (plan.groups.length === 0) {
    lines.push('중복 후보: 없음');
  } else {
    lines.push(`중복 후보 (${plan.groups.length} 그룹):`);
    plan.groups.forEach((group, idx) => {
      lines.push('');
      lines.push(`[그룹 ${idx + 1}] ${describeReason(group.reason)}: ${group.identityKey}`);
      lines.push(`  유지: ${group.primary.accountKey}${formatPrimaryHints(group.primary)}`);
      for (const dup of group.duplicates) {
        lines.push(`  제거 후보: ${dup.accountKey} (reason=${group.reason}${formatDupHints(dup)})`);
      }
    });
  }

  if (options.backfillAccountId) {
    lines.push('');
    if (plan.backfillCandidates.length === 0) {
      lines.push('accountId backfill 후보: 없음');
    } else {
      lines.push(`accountId backfill 후보 (${plan.backfillCandidates.length}):`);
      for (const c of plan.backfillCandidates) {
        lines.push(`  ${c.accountKey} → accountId=${c.sub}`);
      }
    }
  }

  if (!options.apply) {
    lines.push('');
    if (
      plan.groups.length === 0 &&
      (!options.backfillAccountId || plan.backfillCandidates.length === 0)
    ) {
      lines.push('변경 사항이 없습니다 (dry-run).');
    } else {
      lines.push('실제 반영을 원하면 --apply 옵션을 추가하세요:');
      const applyExample = options.backfillAccountId
        ? `  token-weather doctor ${shortProviderName(providerId)} --dedupe --backfill-account-id --apply`
        : `  token-weather doctor ${shortProviderName(providerId)} --dedupe --apply`;
      lines.push(applyExample);
    }
  }

  return lines;
}

/**
 * --apply 후 실제 변경 결과 출력.
 *
 * @param {{ groups: any[], backfillCandidates: any[] }} plan
 * @returns {string[]}
 */
export function formatDedupeApplied(plan) {
  const lines = [''];
  lines.push('정리 결과:');
  let removedCount = 0;
  for (const group of plan.groups) {
    for (const dup of group.duplicates) {
      lines.push(`  ✓ 제거: ${dup.accountKey} (${group.reason})`);
      removedCount += 1;
    }
  }
  for (const c of plan.backfillCandidates) {
    lines.push(`  ✓ backfill: ${c.accountKey} → accountId=${c.sub}`);
  }
  lines.push('');
  const summary = [];
  if (removedCount > 0) summary.push(`${removedCount}건 제거`);
  if (plan.backfillCandidates.length > 0)
    summary.push(`${plan.backfillCandidates.length}건 backfill`);
  lines.push(`총 ${summary.join(' + ')}. auth.json 갱신 완료.`);
  return lines;
}

/**
 * --apply 했지만 변경 사항이 없을 때.
 *
 * @returns {string[]}
 */
export function formatDedupeNoChanges() {
  return ['', '변경 사항이 없습니다.'];
}

function describeReason(reason) {
  return reason === 'same-sub' ? 'sub 일치' : 'email 일치';
}

function formatPrimaryHints(primary) {
  const hints = [];
  if (primary.source) hints.push(`source=${primary.source}`);
  if (primary.updatedAt) hints.push(`updatedAt=${primary.updatedAt}`);
  if (primary.status === 'disabled') hints.push('status=disabled');
  return hints.length > 0 ? ` (${hints.join(', ')})` : '';
}

function formatDupHints(dup) {
  const hints = [];
  if (dup.accountId === null || dup.accountId === undefined) hints.push('accountId=null');
  if (dup.status === 'disabled') hints.push('status=disabled');
  return hints.length > 0 ? `, ${hints.join(', ')}` : '';
}

function providerLabelFor(providerId) {
  if (providerId === 'openai-codex') return 'codex';
  if (providerId === 'claude') return 'claude';
  return providerId;
}

function shortProviderName(providerId) {
  return providerLabelFor(providerId);
}
