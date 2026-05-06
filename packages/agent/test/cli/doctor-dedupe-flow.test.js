import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDedupePlan,
  applyDedupePlan,
  findBackfillCandidates,
} from '../../src/cli/doctor-dedupe-flow.js';
import { createEmptyAuthStore, createAccount } from '../../src/auth/auth-store-schema.js';
import { upsertProviderAccount } from '../../src/auth/auth-store.js';

// base64url for { "sub": "google-oauth2|115" }
const JWT_SUB_A = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJnb29nbGUtb2F1dGgyfDExNSJ9.';

describe('findBackfillCandidates', () => {
  it('returns [] for empty / non-array input', () => {
    assert.deepEqual(findBackfillCandidates([]), []);
    assert.deepEqual(findBackfillCandidates(null), []);
    assert.deepEqual(findBackfillCandidates(undefined), []);
  });

  it('skips accounts with accountId set', () => {
    const accounts = [
      { accountKey: 'a', accountId: 'sub1', raw: { idToken: JWT_SUB_A } },
    ];
    assert.deepEqual(findBackfillCandidates(accounts), []);
  });

  it('skips accounts without raw.idToken', () => {
    const accounts = [{ accountKey: 'a', accountId: null }];
    assert.deepEqual(findBackfillCandidates(accounts), []);
  });

  it('extracts sub from raw.idToken when accountId is missing', () => {
    const accounts = [
      { accountKey: 'a', accountId: null, raw: { idToken: JWT_SUB_A } },
      { accountKey: 'b', accountId: 'sub-existing' }, // 무시됨
    ];
    const out = findBackfillCandidates(accounts);
    assert.equal(out.length, 1);
    assert.deepEqual(out[0], { accountKey: 'a', sub: 'google-oauth2|115' });
  });

  it('skips when idToken decode fails (no sub)', () => {
    const noSub = 'eyJhbGciOiJub25lIn0.eyJlbWFpbCI6ImFAeC5jb20ifQ.'; // { email: a@x.com }
    const accounts = [{ accountKey: 'a', accountId: null, raw: { idToken: noSub } }];
    assert.deepEqual(findBackfillCandidates(accounts), []);
  });
});

describe('buildDedupePlan', () => {
  it('returns empty plan when no duplicates and backfill option off', () => {
    const accounts = [
      { accountKey: 'a', accountId: 'sub1', email: 'a@x.com', source: 'agent-store' },
    ];
    const plan = buildDedupePlan({ accounts, options: { backfillAccountId: false } });
    assert.deepEqual(plan.groups, []);
    assert.deepEqual(plan.backfillCandidates, []);
  });

  it('returns groups but skips backfill when option is off', () => {
    const accounts = [
      {
        accountKey: 'a',
        accountId: null,
        email: 'a@x.com',
        raw: { idToken: JWT_SUB_A },
        source: 'agent-store',
      },
      {
        accountKey: 'b',
        accountId: 'google-oauth2|115',
        email: 'a@x.com',
        source: 'agent-store',
      },
    ];
    const plan = buildDedupePlan({ accounts, options: { backfillAccountId: false } });
    assert.equal(plan.groups.length, 1);
    assert.deepEqual(plan.backfillCandidates, []);
  });

  it('includes backfill candidates when option is on', () => {
    const accounts = [
      {
        accountKey: 'a',
        accountId: null,
        email: 'a@x.com',
        raw: { idToken: JWT_SUB_A },
        source: 'agent-store',
      },
    ];
    const plan = buildDedupePlan({ accounts, options: { backfillAccountId: true } });
    assert.deepEqual(plan.groups, []);
    assert.equal(plan.backfillCandidates.length, 1);
    assert.equal(plan.backfillCandidates[0].sub, 'google-oauth2|115');
  });
});

describe('applyDedupePlan', () => {
  it('removes duplicate accountKeys from store', () => {
    let store = createEmptyAuthStore();
    store = upsertProviderAccount(
      store,
      'openai-codex',
      createAccount({
        accountKey: 'primary',
        email: 'a@x.com',
        accountId: 'sub1',
      }),
    );
    store = upsertProviderAccount(
      store,
      'openai-codex',
      createAccount({
        accountKey: 'duplicate',
        email: 'a@x.com',
        accountId: null,
      }),
    );

    const plan = {
      groups: [
        {
          reason: 'same-email',
          identityKey: 'a@x.com',
          primary: { accountKey: 'primary' },
          duplicates: [{ accountKey: 'duplicate' }],
        },
      ],
      backfillCandidates: [],
    };

    const next = applyDedupePlan(store, 'openai-codex', plan);
    const accounts = next.providers['openai-codex'].accounts;
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].accountKey, 'primary');
  });

  it('applies backfill — fills accountId from sub', () => {
    let store = createEmptyAuthStore();
    store = upsertProviderAccount(
      store,
      'openai-codex',
      createAccount({
        accountKey: 'legacy',
        email: 'a@x.com',
        accountId: null,
        raw: { idToken: JWT_SUB_A },
      }),
    );

    const plan = {
      groups: [],
      backfillCandidates: [{ accountKey: 'legacy', sub: 'google-oauth2|115' }],
    };

    const next = applyDedupePlan(store, 'openai-codex', plan);
    const account = next.providers['openai-codex'].accounts[0];
    assert.equal(account.accountId, 'google-oauth2|115');
  });

  it('removal + backfill 동시 적용', () => {
    let store = createEmptyAuthStore();
    store = upsertProviderAccount(
      store,
      'openai-codex',
      createAccount({
        accountKey: 'primary',
        accountId: 'sub1',
        email: 'a@x.com',
      }),
    );
    store = upsertProviderAccount(
      store,
      'openai-codex',
      createAccount({
        accountKey: 'dup',
        accountId: null,
        email: 'a@x.com',
      }),
    );
    store = upsertProviderAccount(
      store,
      'openai-codex',
      createAccount({
        accountKey: 'legacy',
        accountId: null,
        email: 'b@x.com',
        raw: { idToken: JWT_SUB_A },
      }),
    );

    const plan = {
      groups: [
        {
          reason: 'same-email',
          identityKey: 'a@x.com',
          primary: { accountKey: 'primary' },
          duplicates: [{ accountKey: 'dup' }],
        },
      ],
      backfillCandidates: [{ accountKey: 'legacy', sub: 'google-oauth2|115' }],
    };

    const next = applyDedupePlan(store, 'openai-codex', plan);
    const accounts = next.providers['openai-codex'].accounts;
    assert.equal(accounts.length, 2);
    assert.ok(accounts.find((a) => a.accountKey === 'primary'));
    const legacy = accounts.find((a) => a.accountKey === 'legacy');
    assert.equal(legacy.accountId, 'google-oauth2|115');
    // dup 은 제거됨
    assert.ok(!accounts.find((a) => a.accountKey === 'dup'));
  });

  it('빈 plan 은 store 변경 없음', () => {
    let store = createEmptyAuthStore();
    store = upsertProviderAccount(
      store,
      'openai-codex',
      createAccount({ accountKey: 'a', email: 'a@x.com' }),
    );
    const next = applyDedupePlan(store, 'openai-codex', {
      groups: [],
      backfillCandidates: [],
    });
    assert.equal(next.providers['openai-codex'].accounts.length, 1);
  });
});
