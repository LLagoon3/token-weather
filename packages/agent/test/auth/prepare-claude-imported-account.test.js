import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { prepareClaudeImportedAccount } from '../../src/auth/prepare-claude-imported-account.js';

const NOW = '2024-06-01T00:00:00.000Z';

const baseAccount = {
  accountKey: 'claude:imported-user',
  email: 'imported@example.com',
  source: 'claude-cli-import',
  authType: 'oauth',
  status: 'active',
};

describe('prepareClaudeImportedAccount', () => {
  it('returns null account and no-selected-account reason when selectedAccount is absent', () => {
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
    const result = prepareClaudeImportedAccount(baseAccount, NOW);
    const { account } = result;
    assert.equal(account.provider, 'claude');
    assert.equal(account.source, 'claude-cli-import');
    assert.equal(account.authType, 'oauth');
    assert.equal(account.status, 'active');
    assert.ok(account.raw && typeof account.raw === 'object');
    assert.equal(account.raw.importedFrom, 'claude-cli');
  });

  it('now argument is reflected in createdAt and updatedAt', () => {
    const result = prepareClaudeImportedAccount(baseAccount, NOW);
    assert.equal(result.account.createdAt, NOW);
    assert.equal(result.account.updatedAt, NOW);
  });
});
