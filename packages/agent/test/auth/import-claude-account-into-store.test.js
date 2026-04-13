import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { importClaudeAccountIntoStore } from '../../src/auth/import-claude-account-into-store.js';
import { createEmptyAuthStore } from '../../src/auth/auth-store-schema.js';

const NOW = '2024-06-01T00:00:00.000Z';
const NOW2 = '2024-06-02T00:00:00.000Z';

const baseSelectedAccount = {
  accountKey: 'claude:imported-user',
  email: 'imported@example.com',
  source: 'claude-cli-import',
  authType: 'oauth',
  status: 'active',
};

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
    const result = importClaudeAccountIntoStore(store, baseSelectedAccount, NOW);

    assert.equal(result.reason, 'store-updated');
    assert.ok(result.account !== null);
    assert.equal(result.account.accountKey, 'claude:imported-user');
  });

  it('does not mutate original store', () => {
    const store = createEmptyAuthStore();
    const originalProvidersSnapshot = JSON.stringify(store.providers);

    importClaudeAccountIntoStore(store, baseSelectedAccount, NOW);

    assert.equal(JSON.stringify(store.providers), originalProvidersSnapshot);
  });

  it('upserts account into claude provider in nextStore', () => {
    const store = createEmptyAuthStore();
    const { store: nextStore } = importClaudeAccountIntoStore(store, baseSelectedAccount, NOW);

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

    const { store: nextStore } = importClaudeAccountIntoStore(store, baseSelectedAccount, NOW);

    assert.ok(nextStore.providers['other-provider']);
    assert.equal(nextStore.providers['other-provider'].accounts[0].accountKey, 'other:user');
    assert.ok(nextStore.providers['claude']);
  });

  it('upserts (merges) on re-import with same accountKey', () => {
    const store = createEmptyAuthStore();
    const { store: storeAfterFirst } = importClaudeAccountIntoStore(store, baseSelectedAccount, NOW);

    const updatedAccount = { ...baseSelectedAccount, email: 'updated@example.com' };
    const { store: storeAfterSecond } = importClaudeAccountIntoStore(storeAfterFirst, updatedAccount, NOW2);

    const accounts = storeAfterSecond.providers['claude'].accounts;
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].email, 'updated@example.com');
  });

  it('account in result has correct provider, authType, and source fields', () => {
    const store = createEmptyAuthStore();
    const { account } = importClaudeAccountIntoStore(store, baseSelectedAccount, NOW);

    assert.equal(account.provider, 'claude');
    assert.equal(account.authType, 'oauth');
    assert.equal(account.source, 'claude-cli-import');
  });
});
