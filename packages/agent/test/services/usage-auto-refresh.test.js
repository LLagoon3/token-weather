import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { __testables, fetchUsageWithAutoRefresh } from '../../src/services/usage-auto-refresh.js';

function makeEntry(overrides = {}) {
  const account = {
    accountKey: 'acct-1',
    expiresAt: null,
    tokens: {
      accessToken: 'old-at',
      refreshToken: 'rt-1',
    },
    ...overrides.account,
  };
  return {
    account,
    profile: {
      id: account.accountKey,
      accountKey: account.accountKey,
      accessToken: account.tokens?.accessToken ?? account.accessToken,
      email: 'user@example.com',
      ...overrides.profile,
    },
  };
}

function makeSpec(overrides = {}) {
  return {
    fetchUsage: async (profile) => ({
      account: { profileId: profile.id },
      status: { bucket: 'ok', ok: true },
    }),
    refreshToken: async () => ({
      accessToken: 'new-at',
      refreshToken: 'new-rt',
      expiresIn: 3600,
    }),
    updateStoreAfterRefresh: async () => ({ accountKey: 'acct-1', expiresAt: null }),
    mapAccountToProfile: (account) => ({
      id: account.accountKey,
      accountKey: account.accountKey,
      accessToken: account.tokens.accessToken,
      email: 'user@example.com',
    }),
    ...overrides,
  };
}

describe('usage-auto-refresh helpers', () => {
  it('treats past expiresAt as expired', () => {
    assert.equal(__testables.isExpired('2000-01-01T00:00:00.000Z'), true);
  });

  it('treats future expiresAt as not expired', () => {
    assert.equal(__testables.isExpired('2999-01-01T00:00:00.000Z'), false);
  });
});

describe('fetchUsageWithAutoRefresh', () => {
  it('refreshes before fetch when access token is already expired', async () => {
    const calls = [];
    const result = await fetchUsageWithAutoRefresh(
      makeEntry({
        account: { expiresAt: '2000-01-01T00:00:00.000Z' },
      }),
      makeSpec({
        refreshToken: async () => {
          calls.push('refresh');
          return { accessToken: 'new-at', refreshToken: 'new-rt', expiresIn: 3600 };
        },
        updateStoreAfterRefresh: async () => {
          calls.push('store');
          return { accountKey: 'acct-1', expiresAt: null };
        },
        fetchUsage: async (profile) => {
          calls.push(`fetch:${profile.accessToken}`);
          return { status: { bucket: 'ok', ok: true } };
        },
      }),
    );

    assert.deepEqual(calls, ['refresh', 'store', 'fetch:new-at']);
    assert.equal(result.account.accessToken, 'new-at');
  });

  it('refreshes once after auth failure and retries fetch', async () => {
    const calls = [];
    let attempt = 0;
    const result = await fetchUsageWithAutoRefresh(
      makeEntry(),
      makeSpec({
        fetchUsage: async (profile) => {
          attempt += 1;
          calls.push(`fetch:${attempt}:${profile.accessToken}`);
          if (attempt === 1) return { status: { bucket: 'auth', ok: false } };
          return { status: { bucket: 'ok', ok: true } };
        },
        refreshToken: async () => {
          calls.push('refresh');
          return { accessToken: 'new-at', refreshToken: 'new-rt', expiresIn: 3600 };
        },
        updateStoreAfterRefresh: async () => {
          calls.push('store');
          return { accountKey: 'acct-1', expiresAt: null };
        },
      }),
    );

    assert.deepEqual(calls, ['fetch:1:old-at', 'refresh', 'store', 'fetch:2:new-at']);
    assert.equal(result.snapshot.status.bucket, 'ok');
  });

  it('does not attempt refresh for import entries without raw account', async () => {
    const calls = [];
    const result = await fetchUsageWithAutoRefresh(
      {
        account: null,
        profile: {
          id: 'import-1',
          accountKey: 'import-1',
          accessToken: 'import-at',
        },
      },
      makeSpec({
        fetchUsage: async () => {
          calls.push('fetch');
          return { status: { bucket: 'auth', ok: false } };
        },
        refreshToken: async () => {
          calls.push('refresh');
          return { accessToken: 'new-at', refreshToken: 'new-rt', expiresIn: 3600 };
        },
      }),
    );

    assert.deepEqual(calls, ['fetch']);
    assert.equal(result.snapshot.status.bucket, 'auth');
  });

  it('surfaces refresh failure when an expired account cannot be refreshed', async () => {
    await assert.rejects(
      () =>
        fetchUsageWithAutoRefresh(
          makeEntry({
            account: { expiresAt: '2000-01-01T00:00:00.000Z' },
          }),
          makeSpec({
            refreshToken: async () => {
              throw new Error('invalid_grant');
            },
          }),
        ),
      /invalid_grant/,
    );
  });
});
