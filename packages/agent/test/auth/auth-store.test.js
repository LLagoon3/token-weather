import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createEmptyAuthStore,
  AUTH_STORE_VERSION,
  createAccount,
} from '../../src/auth/auth-store-schema.js';
import {
  upsertProviderAccount,
  removeProviderAccount,
} from '../../src/auth/auth-store.js';

describe('createEmptyAuthStore', () => {
  it('returns a store with correct version and empty providers', () => {
    const store = createEmptyAuthStore();
    assert.equal(store.version, AUTH_STORE_VERSION);
    assert.deepStrictEqual(store.providers, {});
    assert.ok(store.updatedAt);
  });
});

describe('upsertProviderAccount', () => {
  it('inserts a new account into an empty store', () => {
    const store = createEmptyAuthStore();
    const account = createAccount({
      accountKey: 'codex:alice@example.com',
      email: 'alice@example.com',
    });

    const next = upsertProviderAccount(store, 'openai-codex', account);

    assert.equal(next.providers['openai-codex'].accounts.length, 1);
    assert.equal(next.providers['openai-codex'].accounts[0].email, 'alice@example.com');
  });

  it('updates an existing account matched by accountKey', () => {
    const store = createEmptyAuthStore();
    const account = createAccount({
      accountKey: 'codex:alice@example.com',
      email: 'alice@example.com',
      displayName: 'Alice',
    });

    let next = upsertProviderAccount(store, 'openai-codex', account);
    next = upsertProviderAccount(next, 'openai-codex', {
      accountKey: 'codex:alice@example.com',
      email: 'alice-new@example.com',
    });

    assert.equal(next.providers['openai-codex'].accounts.length, 1);
    assert.equal(next.providers['openai-codex'].accounts[0].email, 'alice-new@example.com');
    // displayName from original should be preserved via spread
    assert.equal(next.providers['openai-codex'].accounts[0].displayName, 'Alice');
  });

  it('does not mutate the original store', () => {
    const store = createEmptyAuthStore();
    const account = createAccount({
      accountKey: 'codex:bob@example.com',
      email: 'bob@example.com',
    });

    upsertProviderAccount(store, 'openai-codex', account);
    assert.deepStrictEqual(store.providers, {});
  });

  it('appends a second account for the same provider', () => {
    const store = createEmptyAuthStore();
    const a1 = createAccount({ accountKey: 'codex:a', email: 'a@x.com' });
    const a2 = createAccount({ accountKey: 'codex:b', email: 'b@x.com' });

    let next = upsertProviderAccount(store, 'openai-codex', a1);
    next = upsertProviderAccount(next, 'openai-codex', a2);

    assert.equal(next.providers['openai-codex'].accounts.length, 2);
  });
});

describe('removeProviderAccount', () => {
  it('removes an account by accountKey', () => {
    const store = createEmptyAuthStore();
    const account = createAccount({
      accountKey: 'codex:alice@example.com',
      email: 'alice@example.com',
    });

    let next = upsertProviderAccount(store, 'openai-codex', account);
    next = removeProviderAccount(next, 'openai-codex', 'codex:alice@example.com');

    assert.equal(next.providers['openai-codex'].accounts.length, 0);
  });

  it('is a no-op for a non-existent provider', () => {
    const store = createEmptyAuthStore();
    const next = removeProviderAccount(store, 'nonexistent', 'key');
    assert.deepStrictEqual(next.providers, {});
  });

  it('is a no-op for a non-existent accountKey', () => {
    const store = createEmptyAuthStore();
    const account = createAccount({
      accountKey: 'codex:keep',
      email: 'keep@x.com',
    });

    let next = upsertProviderAccount(store, 'openai-codex', account);
    next = removeProviderAccount(next, 'openai-codex', 'codex:gone');

    assert.equal(next.providers['openai-codex'].accounts.length, 1);
  });

  it('does not mutate the original store', () => {
    const store = createEmptyAuthStore();
    const account = createAccount({ accountKey: 'codex:x', email: 'x@x.com' });
    const withAccount = upsertProviderAccount(store, 'openai-codex', account);

    removeProviderAccount(withAccount, 'openai-codex', 'codex:x');
    assert.equal(withAccount.providers['openai-codex'].accounts.length, 1);
  });
});

describe('createAccount', () => {
  it('fills defaults for optional fields', () => {
    const account = createAccount({ accountKey: 'k', email: 'e@e.com' });

    assert.equal(account.accountKey, 'k');
    assert.equal(account.email, 'e@e.com');
    assert.equal(account.status, 'active');
    assert.equal(account.authType, 'oauth');
    assert.equal(account.source, 'agent-store');
    assert.equal(account.displayName, null);
    assert.equal(account.lastUsedAt, null);
    assert.ok(account.createdAt);
    assert.ok(account.updatedAt);
  });
});
