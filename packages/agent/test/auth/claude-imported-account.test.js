import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createClaudeImportedAccountPayload,
  prepareClaudeImportedAccount,
  importClaudeAccountIntoStore,
} from '../../src/auth/claude-imported-account.js';
import { createEmptyAuthStore } from '../../src/auth/auth-store-schema.js';

const NOW = '2024-06-01T00:00:00.000Z';
const NOW2 = '2024-06-02T00:00:00.000Z';

const baseAccount = {
  accountKey: 'claude:imported-user',
  email: 'imported@example.com',
  source: 'claude-cli-import',
  authType: 'oauth',
  status: 'active',
};

describe('createClaudeImportedAccountPayload', () => {
  it('returns null when selectedAccount is falsy', () => {
    assert.equal(createClaudeImportedAccountPayload(null), null);
    assert.equal(createClaudeImportedAccountPayload(undefined), null);
    assert.equal(createClaudeImportedAccountPayload(), null);
  });

  it('maps basic fields correctly', () => {
    const payload = createClaudeImportedAccountPayload(baseAccount, NOW);
    assert.equal(payload.provider, 'claude');
    assert.equal(payload.accountKey, 'claude:imported-user');
    assert.equal(payload.email, 'imported@example.com');
  });

  it('reflects the fixed now argument in createdAt and updatedAt', () => {
    const payload = createClaudeImportedAccountPayload(baseAccount, NOW);
    assert.equal(payload.createdAt, NOW);
    assert.equal(payload.updatedAt, NOW);
  });

  it('falls back source, authType, status when absent', () => {
    const minimal = { accountKey: 'claude:x' };
    const payload = createClaudeImportedAccountPayload(minimal, NOW);
    assert.equal(payload.source, 'claude-cli-import');
    assert.equal(payload.authType, 'oauth');
    assert.equal(payload.status, 'active');
    assert.equal(payload.email, null);
  });

  it('raw contains only importedFrom and source provenance', () => {
    const payload = createClaudeImportedAccountPayload(baseAccount, NOW);
    assert.deepEqual(payload.raw, {
      importedFrom: 'claude-cli',
      source: 'claude-cli-import',
    });
  });
});

describe('prepareClaudeImportedAccount', () => {
  it('returns null account and no-selected-account reason when absent', () => {
    for (const input of [null, undefined]) {
      const result = prepareClaudeImportedAccount(input, NOW);
      assert.equal(result.account, null);
      assert.equal(result.reason, 'no-selected-account');
    }
  });

  it('returns prepared-import reason when selectedAccount is present', () => {
    const result = prepareClaudeImportedAccount(baseAccount, NOW);
    assert.equal(result.reason, 'prepared-import');
    assert.notEqual(result.account, null);
  });

  it('returned account includes provider, source, authType, status, and raw shape', () => {
    const { account } = prepareClaudeImportedAccount(baseAccount, NOW);
    assert.equal(account.provider, 'claude');
    assert.equal(account.source, 'claude-cli-import');
    assert.equal(account.authType, 'oauth');
    assert.equal(account.status, 'active');
    assert.ok(account.raw && typeof account.raw === 'object');
    assert.equal(account.raw.importedFrom, 'claude-cli');
  });

  it('now argument is reflected in createdAt and updatedAt', () => {
    const { account } = prepareClaudeImportedAccount(baseAccount, NOW);
    assert.equal(account.createdAt, NOW);
    assert.equal(account.updatedAt, NOW);
  });
});

describe('importClaudeAccountIntoStore', () => {
  it('returns original store unchanged when selectedAccount is null', () => {
    const store = createEmptyAuthStore();
    const result = importClaudeAccountIntoStore(store, null, NOW);
    assert.equal(result.account, null);
    assert.equal(result.reason, 'no-selected-account');
    assert.strictEqual(result.store, store);
  });

  it('returns original store unchanged when selectedAccount is undefined', () => {
    const store = createEmptyAuthStore();
    const result = importClaudeAccountIntoStore(store, undefined, NOW);
    assert.equal(result.account, null);
    assert.equal(result.reason, 'no-selected-account');
    assert.strictEqual(result.store, store);
  });

  it('returns store-updated reason and account when selectedAccount is present', () => {
    const store = createEmptyAuthStore();
    const result = importClaudeAccountIntoStore(store, baseAccount, NOW);
    assert.equal(result.reason, 'store-updated');
    assert.ok(result.account !== null);
    assert.equal(result.account.accountKey, 'claude:imported-user');
  });

  it('does not mutate original store', () => {
    const store = createEmptyAuthStore();
    const originalProvidersSnapshot = JSON.stringify(store.providers);
    importClaudeAccountIntoStore(store, baseAccount, NOW);
    assert.equal(JSON.stringify(store.providers), originalProvidersSnapshot);
  });

  it('upserts account into claude provider in nextStore', () => {
    const store = createEmptyAuthStore();
    const { store: nextStore } = importClaudeAccountIntoStore(store, baseAccount, NOW);
    const claudeAccounts = nextStore.providers['claude']?.accounts ?? [];
    assert.equal(claudeAccounts.length, 1);
    assert.equal(claudeAccounts[0].accountKey, 'claude:imported-user');
    assert.equal(claudeAccounts[0].email, 'imported@example.com');
  });

  it('preserves existing store structure (other providers intact)', () => {
    const store = createEmptyAuthStore();
    store.providers['other-provider'] = {
      accounts: [{ accountKey: 'other:user', email: 'other@example.com' }],
    };
    const { store: nextStore } = importClaudeAccountIntoStore(store, baseAccount, NOW);
    assert.ok(nextStore.providers['other-provider']);
    assert.equal(nextStore.providers['other-provider'].accounts[0].accountKey, 'other:user');
    assert.ok(nextStore.providers['claude']);
  });

  it('upserts (merges) on re-import with same accountKey', () => {
    const store = createEmptyAuthStore();
    const { store: storeAfterFirst } = importClaudeAccountIntoStore(store, baseAccount, NOW);
    const updatedAccount = { ...baseAccount, email: 'updated@example.com' };
    const { store: storeAfterSecond } = importClaudeAccountIntoStore(
      storeAfterFirst,
      updatedAccount,
      NOW2,
    );
    const accounts = storeAfterSecond.providers['claude'].accounts;
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].email, 'updated@example.com');
  });

  it('account in result has correct provider, authType, and source fields', () => {
    const store = createEmptyAuthStore();
    const { account } = importClaudeAccountIntoStore(store, baseAccount, NOW);
    assert.equal(account.provider, 'claude');
    assert.equal(account.authType, 'oauth');
    assert.equal(account.source, 'claude-cli-import');
  });
});
