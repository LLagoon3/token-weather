import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDedupeProposal,
  formatDedupeApplied,
  formatDedupeNoChanges,
} from '../../src/cli/doctor-dedupe-formatters.js';

describe('formatDedupeProposal — 중복 없음', () => {
  it('"중복 후보: 없음" 출력 + dry-run 메시지', () => {
    const lines = formatDedupeProposal({
      providerId: 'openai-codex',
      accounts: [{ accountKey: 'a' }],
      plan: { groups: [], backfillCandidates: [] },
      options: { apply: false, backfillAccountId: false },
    });
    const text = lines.join('\n');
    assert.match(text, /codex 계정 dedupe 검사/);
    assert.match(text, /저장된 codex 계정: 1/);
    assert.match(text, /중복 후보: 없음/);
    assert.match(text, /변경 사항이 없습니다 \(dry-run\)/);
  });
});

describe('formatDedupeProposal — 중복 그룹 1건', () => {
  it('그룹 + primary + duplicates 표시 + apply 안내', () => {
    const lines = formatDedupeProposal({
      providerId: 'openai-codex',
      accounts: [{ accountKey: 'a' }, { accountKey: 'b' }],
      plan: {
        groups: [
          {
            reason: 'same-sub',
            identityKey: 'google-oauth2|115',
            primary: {
              accountKey: 'a',
              source: 'agent-store',
              updatedAt: '2026-04-29T00:00:00Z',
            },
            duplicates: [{ accountKey: 'b', accountId: null }],
          },
        ],
        backfillCandidates: [],
      },
      options: { apply: false, backfillAccountId: false },
    });
    const text = lines.join('\n');
    assert.match(text, /중복 후보 \(1 그룹\)/);
    assert.match(text, /\[그룹 1\] sub 일치: google-oauth2\|115/);
    assert.match(text, /유지: a \(source=agent-store, updatedAt=2026-04-29/);
    assert.match(text, /제거 후보: b \(reason=same-sub, accountId=null\)/);
    assert.match(text, /token-weather doctor codex --dedupe --apply/);
  });
});

describe('formatDedupeProposal — backfill 옵션', () => {
  it('backfill 후보 출력 + apply 명령에 --backfill-account-id 포함', () => {
    const lines = formatDedupeProposal({
      providerId: 'openai-codex',
      accounts: [{ accountKey: 'a' }],
      plan: {
        groups: [],
        backfillCandidates: [{ accountKey: 'a', sub: 'google-oauth2|115' }],
      },
      options: { apply: false, backfillAccountId: true },
    });
    const text = lines.join('\n');
    assert.match(text, /accountId backfill 후보 \(1\)/);
    assert.match(text, /a → accountId=google-oauth2\|115/);
    assert.match(text, /--dedupe --backfill-account-id --apply/);
  });

  it('backfill 옵션 켜져있고 후보 0건', () => {
    const lines = formatDedupeProposal({
      providerId: 'openai-codex',
      accounts: [],
      plan: { groups: [], backfillCandidates: [] },
      options: { apply: false, backfillAccountId: true },
    });
    const text = lines.join('\n');
    assert.match(text, /accountId backfill 후보: 없음/);
  });
});

describe('formatDedupeApplied', () => {
  it('제거 + backfill 모두 보고', () => {
    const lines = formatDedupeApplied({
      groups: [
        {
          reason: 'same-sub',
          duplicates: [{ accountKey: 'dup1' }, { accountKey: 'dup2' }],
        },
      ],
      backfillCandidates: [{ accountKey: 'a', sub: 'google-oauth2|115' }],
    });
    const text = lines.join('\n');
    assert.match(text, /✓ 제거: dup1 \(same-sub\)/);
    assert.match(text, /✓ 제거: dup2 \(same-sub\)/);
    assert.match(text, /✓ backfill: a → accountId=google-oauth2\|115/);
    assert.match(text, /총 2건 제거 \+ 1건 backfill/);
  });

  it('제거만 (backfill 없음)', () => {
    const lines = formatDedupeApplied({
      groups: [{ reason: 'same-sub', duplicates: [{ accountKey: 'dup1' }] }],
      backfillCandidates: [],
    });
    const text = lines.join('\n');
    assert.match(text, /총 1건 제거\./);
    assert.doesNotMatch(text, /backfill/);
  });
});

describe('formatDedupeNoChanges', () => {
  it('변경 없음 메시지', () => {
    const lines = formatDedupeNoChanges();
    const text = lines.join('\n');
    assert.match(text, /변경 사항이 없습니다/);
  });
});

describe('formatDedupeProposal — claude provider', () => {
  it('claude label 사용', () => {
    const lines = formatDedupeProposal({
      providerId: 'claude',
      accounts: [],
      plan: { groups: [], backfillCandidates: [] },
      options: { apply: false, backfillAccountId: false },
    });
    const text = lines.join('\n');
    assert.match(text, /claude 계정 dedupe 검사/);
  });
});
