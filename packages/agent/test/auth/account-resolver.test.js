import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveDefaultAccount,
  resolveAccountByIdentifier,
  resolveAccount,
} from '../../src/auth/account-resolver.js';

describe('resolveDefaultAccount', () => {
  it('returns null with reason "no-accounts" for empty array', () => {
    const result = resolveDefaultAccount([]);
    assert.equal(result.account, null);
    assert.equal(result.reason, 'no-accounts');
  });

  it('returns null with reason "no-accounts" for null/undefined', () => {
    assert.equal(resolveDefaultAccount(null).reason, 'no-accounts');
    assert.equal(resolveDefaultAccount(undefined).reason, 'no-accounts');
  });

  it('auto-selects the single active account', () => {
    const accounts = [{ accountKey: 'a', status: 'active' }];
    const result = resolveDefaultAccount(accounts);
    assert.equal(result.account.accountKey, 'a');
    assert.equal(result.reason, 'single-account');
  });

  it('auto-selects account with no status field (backward-compat)', () => {
    const accounts = [{ accountKey: 'legacy' }];
    const result = resolveDefaultAccount(accounts);
    assert.equal(result.account.accountKey, 'legacy');
    assert.equal(result.reason, 'single-account');
  });

  it('skips disabled accounts', () => {
    const accounts = [
      { accountKey: 'disabled-one', status: 'disabled' },
      { accountKey: 'active-one', status: 'active' },
    ];
    const result = resolveDefaultAccount(accounts);
    assert.equal(result.account.accountKey, 'active-one');
    assert.equal(result.reason, 'single-account');
  });

  it('returns null when all accounts are disabled', () => {
    const accounts = [
      { accountKey: 'x', status: 'disabled' },
      { accountKey: 'y', status: 'disabled' },
    ];
    const result = resolveDefaultAccount(accounts);
    assert.equal(result.account, null);
    assert.equal(result.reason, 'all-disabled');
  });

  it('picks the most recently used account among multiple active', () => {
    const accounts = [
      { accountKey: 'old', status: 'active', lastUsedAt: '2024-01-01T00:00:00Z' },
      { accountKey: 'new', status: 'active', lastUsedAt: '2024-06-01T00:00:00Z' },
      { accountKey: 'mid', status: 'active', lastUsedAt: '2024-03-01T00:00:00Z' },
    ];
    const result = resolveDefaultAccount(accounts);
    assert.equal(result.account.accountKey, 'new');
    assert.equal(result.reason, 'most-recent');
  });

  it('falls back to updatedAt when lastUsedAt is null', () => {
    const accounts = [
      { accountKey: 'a', status: 'active', lastUsedAt: null, updatedAt: '2024-01-01T00:00:00Z' },
      { accountKey: 'b', status: 'active', lastUsedAt: null, updatedAt: '2024-06-01T00:00:00Z' },
    ];
    const result = resolveDefaultAccount(accounts);
    assert.equal(result.account.accountKey, 'b');
  });
});

describe('resolveAccountByIdentifier', () => {
  const accounts = [
    { accountKey: 'codex:alice', email: 'alice@example.com', status: 'active' },
    { accountKey: 'codex:bob', email: 'bob@example.com', status: 'disabled' },
  ];

  it('finds by email', () => {
    const result = resolveAccountByIdentifier(accounts, 'alice@example.com');
    assert.equal(result.account.accountKey, 'codex:alice');
    assert.equal(result.reason, 'explicit-selection');
  });

  it('finds by accountKey', () => {
    const result = resolveAccountByIdentifier(accounts, 'codex:alice');
    assert.equal(result.account.accountKey, 'codex:alice');
    assert.equal(result.reason, 'explicit-selection');
  });

  it('returns null for disabled account', () => {
    const result = resolveAccountByIdentifier(accounts, 'bob@example.com');
    assert.equal(result.account, null);
    assert.equal(result.reason, 'account-disabled');
  });

  it('returns null for not-found identifier', () => {
    const result = resolveAccountByIdentifier(accounts, 'unknown@x.com');
    assert.equal(result.account, null);
    assert.equal(result.reason, 'not-found');
  });

  it('returns no-accounts for empty array', () => {
    const result = resolveAccountByIdentifier([], 'x');
    assert.equal(result.reason, 'no-accounts');
  });

  it('finds by label', () => {
    const labeledAccounts = [
      { accountKey: 'codex:a', email: 'a@x.com', label: 'work', status: 'active' },
      { accountKey: 'codex:b', email: 'b@x.com', label: 'personal', status: 'active' },
    ];
    const result = resolveAccountByIdentifier(labeledAccounts, 'personal');
    assert.equal(result.account.accountKey, 'codex:b');
    assert.equal(result.reason, 'explicit-selection');
  });

  it('matches case-insensitively on email / accountKey / label', () => {
    const labeledAccounts = [
      { accountKey: 'codex:Alice', email: 'Alice@X.com', label: 'Work', status: 'active' },
    ];
    assert.equal(
      resolveAccountByIdentifier(labeledAccounts, 'ALICE@x.COM').account.accountKey,
      'codex:Alice',
    );
    assert.equal(
      resolveAccountByIdentifier(labeledAccounts, 'codex:alice').account.accountKey,
      'codex:Alice',
    );
    assert.equal(
      resolveAccountByIdentifier(labeledAccounts, 'WORK').account.accountKey,
      'codex:Alice',
    );
  });
});

describe('resolveAccount (combined)', () => {
  const accounts = [
    {
      accountKey: 'codex:alice',
      email: 'alice@x.com',
      status: 'active',
      lastUsedAt: '2024-01-01T00:00:00Z',
    },
    {
      accountKey: 'codex:bob',
      email: 'bob@x.com',
      status: 'active',
      lastUsedAt: '2024-06-01T00:00:00Z',
    },
  ];

  it('uses explicit identifier when provided', () => {
    const result = resolveAccount(accounts, { accountIdentifier: 'alice@x.com' });
    assert.equal(result.account.accountKey, 'codex:alice');
    assert.equal(result.reason, 'explicit-selection');
  });

  it('falls back to default resolution without identifier', () => {
    const result = resolveAccount(accounts);
    assert.equal(result.account.accountKey, 'codex:bob');
    assert.equal(result.reason, 'most-recent');
  });
});
