import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveClaudeAccount } from '../../src/auth/resolve-claude-account.js';

const agentAccount = {
  accountKey: 'claude:agent-user',
  email: 'agent@example.com',
  status: 'active',
  lastUsedAt: '2024-06-01T00:00:00Z',
};

const cliImportAccount = {
  accountKey: 'claude:imported-user',
  email: 'imported@example.com',
  status: 'active',
  lastUsedAt: '2024-01-01T00:00:00Z',
};

describe('resolveClaudeAccount – source priority', () => {
  it('uses agent-store accounts when both are present', () => {
    const result = resolveClaudeAccount([agentAccount], [cliImportAccount]);
    assert.equal(result.account.accountKey, 'claude:agent-user');
    assert.equal(result.authSource, 'agent-store');
  });

  it('falls back to imported accounts when agent-store is empty', () => {
    const result = resolveClaudeAccount([], [cliImportAccount]);
    assert.equal(result.account.accountKey, 'claude:imported-user');
    assert.equal(result.authSource, 'claude-cli-import');
  });

  it('returns null account with not-found when both are empty', () => {
    const result = resolveClaudeAccount([], []);
    assert.equal(result.account, null);
    assert.equal(result.authSource, 'not-found');
    assert.equal(result.reason, 'no-accounts');
  });
});

describe('resolveClaudeAccount – account resolution', () => {
  it('auto-selects single agent account', () => {
    const result = resolveClaudeAccount([agentAccount], []);
    assert.equal(result.account.accountKey, 'claude:agent-user');
    assert.equal(result.reason, 'single-account');
  });

  it('picks most-recent when multiple agent accounts exist', () => {
    const older = { ...agentAccount, accountKey: 'claude:old', lastUsedAt: '2024-01-01T00:00:00Z' };
    const newer = { ...agentAccount, accountKey: 'claude:new', lastUsedAt: '2024-12-01T00:00:00Z' };
    const result = resolveClaudeAccount([older, newer], []);
    assert.equal(result.account.accountKey, 'claude:new');
    assert.equal(result.reason, 'most-recent');
  });

  it('selects by accountIdentifier override', () => {
    const other = { ...agentAccount, accountKey: 'claude:other', email: 'other@example.com', status: 'active' };
    const result = resolveClaudeAccount(
      [agentAccount, other],
      [],
      { accountIdentifier: 'other@example.com' },
    );
    assert.equal(result.account.accountKey, 'claude:other');
    assert.equal(result.reason, 'explicit-selection');
    assert.equal(result.authSource, 'agent-store');
  });

  it('ignores imported list when accountIdentifier is given and agent-store wins', () => {
    const result = resolveClaudeAccount(
      [agentAccount],
      [cliImportAccount],
      { accountIdentifier: 'agent@example.com' },
    );
    assert.equal(result.account.accountKey, 'claude:agent-user');
    assert.equal(result.authSource, 'agent-store');
  });
});
