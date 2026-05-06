import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { findDuplicateGroups } from '../../src/auth/find-duplicate-groups.js';

// base64url for { "sub": "google-oauth2|115", "email": "a@x.com" }
const JWT_SUB_A =
  'eyJhbGciOiJub25lIn0.eyJzdWIiOiJnb29nbGUtb2F1dGgyfDExNSIsImVtYWlsIjoiYUB4LmNvbSJ9.';

describe('findDuplicateGroups — empty / single-account', () => {
  it('returns [] for empty input', () => {
    assert.deepEqual(findDuplicateGroups([]), []);
  });

  it('returns [] for non-array input', () => {
    assert.deepEqual(findDuplicateGroups(null), []);
    assert.deepEqual(findDuplicateGroups(undefined), []);
  });

  it('returns [] when only 1 account', () => {
    assert.deepEqual(
      findDuplicateGroups([{ accountKey: 'a', accountId: 'sub1', email: 'a@x.com' }]),
      [],
    );
  });

  it('returns [] when 2 distinct accounts', () => {
    const accounts = [
      { accountKey: 'a', accountId: 'sub1', email: 'a@x.com' },
      { accountKey: 'b', accountId: 'sub2', email: 'b@x.com' },
    ];
    assert.deepEqual(findDuplicateGroups(accounts), []);
  });
});

describe('findDuplicateGroups — sub matching', () => {
  it('groups two accounts with same accountId (sub)', () => {
    const accounts = [
      {
        accountKey: 'openai-codex:live-old@codex.openai.com',
        accountId: null,
        email: 'live-old@codex.openai.com',
        raw: { idToken: JWT_SUB_A },
        source: 'agent-store',
      },
      {
        accountKey: 'openai-codex:google-oauth2|115',
        accountId: 'google-oauth2|115',
        email: 'a@x.com',
        source: 'agent-store',
        updatedAt: '2026-04-29T00:00:00Z',
      },
    ];
    const groups = findDuplicateGroups(accounts);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].reason, 'same-sub');
    assert.equal(groups[0].identityKey, 'google-oauth2|115');
    // primary = accountId 가 set 된 쪽
    assert.equal(groups[0].primary.accountKey, 'openai-codex:google-oauth2|115');
    assert.equal(groups[0].duplicates.length, 1);
    assert.equal(groups[0].duplicates[0].accountKey, 'openai-codex:live-old@codex.openai.com');
  });

  it('decodes raw.idToken to recover sub when accountId is missing', () => {
    const accounts = [
      {
        accountKey: 'a-legacy',
        accountId: null,
        email: 'live-abc@codex.openai.com',
        raw: { idToken: JWT_SUB_A },
      },
      {
        accountKey: 'a-current',
        accountId: 'google-oauth2|115',
        email: 'a@x.com',
      },
    ];
    const groups = findDuplicateGroups(accounts);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].reason, 'same-sub');
  });
});

describe('findDuplicateGroups — email matching', () => {
  it('groups by email when sub is missing on both', () => {
    const accounts = [
      { accountKey: 'a', email: 'shared@x.com' },
      { accountKey: 'b', email: 'SHARED@x.com' },
    ];
    const groups = findDuplicateGroups(accounts);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].reason, 'same-email');
    assert.equal(groups[0].identityKey.toLowerCase(), 'shared@x.com');
  });

  it('does NOT match synthetic fallback emails (live-xxxx@...)', () => {
    const accounts = [
      { accountKey: 'a', email: 'live-aaaa@codex.openai.com' },
      { accountKey: 'b', email: 'live-aaaa@codex.openai.com' },
    ];
    assert.deepEqual(findDuplicateGroups(accounts), []);
  });
});

describe('findDuplicateGroups — primary 선택 우선순위', () => {
  it('accountId 가 set 된 쪽이 primary', () => {
    const accounts = [
      { accountKey: 'no-id', accountId: null, email: 'a@x.com', source: 'agent-store' },
      { accountKey: 'has-id', accountId: 'sub1', email: 'a@x.com', source: 'agent-store' },
    ];
    const groups = findDuplicateGroups(accounts);
    assert.equal(groups[0].primary.accountKey, 'has-id');
  });

  it('disabled 보다 active 가 primary', () => {
    const accounts = [
      {
        accountKey: 'active',
        accountId: 'sub1',
        email: 'a@x.com',
        status: 'active',
        source: 'agent-store',
      },
      {
        accountKey: 'disabled',
        accountId: 'sub1',
        email: 'a@x.com',
        status: 'disabled',
        source: 'agent-store',
      },
    ];
    const groups = findDuplicateGroups(accounts);
    assert.equal(groups[0].primary.accountKey, 'active');
    assert.equal(groups[0].duplicates[0].accountKey, 'disabled');
  });

  it('agent-store source 가 다른 source 보다 primary', () => {
    const accounts = [
      {
        accountKey: 'imported',
        accountId: 'sub1',
        email: 'a@x.com',
        source: 'claude-cli-import',
      },
      {
        accountKey: 'agent',
        accountId: 'sub1',
        email: 'a@x.com',
        source: 'agent-store',
      },
    ];
    const groups = findDuplicateGroups(accounts);
    assert.equal(groups[0].primary.accountKey, 'agent');
  });

  it('updatedAt 이 최신인 쪽이 primary', () => {
    const accounts = [
      {
        accountKey: 'old',
        accountId: 'sub1',
        email: 'a@x.com',
        source: 'agent-store',
        updatedAt: '2026-04-01T00:00:00Z',
      },
      {
        accountKey: 'new',
        accountId: 'sub1',
        email: 'a@x.com',
        source: 'agent-store',
        updatedAt: '2026-04-29T00:00:00Z',
      },
    ];
    const groups = findDuplicateGroups(accounts);
    assert.equal(groups[0].primary.accountKey, 'new');
  });
});

describe('findDuplicateGroups — manual / mock 제외', () => {
  it('manual / mock 계정은 그룹화 대상에서 제외', () => {
    const accounts = [
      { accountKey: 'manual', accountId: 'sub1', email: 'a@x.com', source: 'manual' },
      {
        accountKey: 'mock',
        accountId: 'sub1',
        email: 'a@x.com',
        raw: { mock: true },
        source: 'agent-store',
      },
      { accountKey: 'real', accountId: 'sub1', email: 'a@x.com', source: 'agent-store' },
    ];
    // manual / mock 둘 다 제외 → real 1개만 남아 그룹 없음
    assert.deepEqual(findDuplicateGroups(accounts), []);
  });

  it('manual / mock 외 두 real 계정만 같은 identity 면 그룹화', () => {
    const accounts = [
      {
        accountKey: 'mock',
        accountId: 'sub1',
        email: 'a@x.com',
        raw: { mock: true },
        source: 'agent-store',
      },
      {
        accountKey: 'real-a',
        accountId: 'sub1',
        email: 'a@x.com',
        source: 'agent-store',
        updatedAt: '2026-04-29T00:00:00Z',
      },
      { accountKey: 'real-b-legacy', accountId: null, email: 'a@x.com', source: 'agent-store' },
    ];
    const groups = findDuplicateGroups(accounts);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].primary.accountKey, 'real-a');
    assert.equal(groups[0].duplicates.length, 1);
    assert.equal(groups[0].duplicates[0].accountKey, 'real-b-legacy');
  });
});

describe('findDuplicateGroups — transitive grouping', () => {
  it('A↔B sub 매칭 + B↔C email 매칭 → 한 그룹으로 묶임 (sub 우선 reason)', () => {
    const accounts = [
      {
        accountKey: 'A',
        accountId: 'sub1',
        email: 'shared@x.com',
        source: 'agent-store',
      },
      {
        accountKey: 'B',
        accountId: 'sub1',
        email: 'shared@x.com',
        source: 'agent-store',
      },
      {
        accountKey: 'C',
        accountId: null,
        email: 'shared@x.com',
        source: 'agent-store',
      },
    ];
    const groups = findDuplicateGroups(accounts);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].reason, 'same-sub');
    assert.equal(groups[0].accounts ?? groups[0].primary, groups[0].primary);
    assert.equal(1 + groups[0].duplicates.length, 3);
  });
});

describe('findDuplicateGroups — 다중 그룹', () => {
  it('서로 다른 identity 의 두 그룹을 동시에 반환', () => {
    const accounts = [
      { accountKey: 'g1-a', accountId: 'sub1', email: 'a@x.com', source: 'agent-store' },
      { accountKey: 'g1-b', accountId: 'sub1', email: 'a@x.com', source: 'agent-store' },
      { accountKey: 'g2-a', accountId: 'sub2', email: 'b@x.com', source: 'agent-store' },
      { accountKey: 'g2-b', accountId: 'sub2', email: 'b@x.com', source: 'agent-store' },
      { accountKey: 'lone', accountId: 'sub3', email: 'c@x.com', source: 'agent-store' },
    ];
    const groups = findDuplicateGroups(accounts);
    assert.equal(groups.length, 2);
    const allKeys = groups.flatMap((g) => [g.primary.accountKey, ...g.duplicates.map((d) => d.accountKey)]).sort();
    assert.deepEqual(allKeys, ['g1-a', 'g1-b', 'g2-a', 'g2-b']);
    // lone 계정은 어느 그룹에도 속하지 않음
    assert.ok(!allKeys.includes('lone'));
  });
});
