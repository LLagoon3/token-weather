import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { selectClaudeAccountsSource } from '../../src/claude/select-claude-accounts-source.js';

const AGENT_ACCOUNT = { provider: 'claude', source: 'agent-store' };
const IMPORTED_ACCOUNT = { provider: 'claude', source: 'claude-cli-import' };

describe('selectClaudeAccountsSource', () => {
  it('returns agent-store when agentAccounts is non-empty', () => {
    const result = selectClaudeAccountsSource([AGENT_ACCOUNT], [IMPORTED_ACCOUNT]);
    assert.equal(result.authSource, 'agent-store');
    assert.deepEqual(result.accounts, [AGENT_ACCOUNT]);
  });

  it('returns claude-cli-import when agentAccounts is empty and importedAccounts is non-empty', () => {
    const result = selectClaudeAccountsSource([], [IMPORTED_ACCOUNT]);
    assert.equal(result.authSource, 'claude-cli-import');
    assert.deepEqual(result.accounts, [IMPORTED_ACCOUNT]);
  });

  it('returns not-found when both are empty', () => {
    const result = selectClaudeAccountsSource([], []);
    assert.equal(result.authSource, 'not-found');
    assert.deepEqual(result.accounts, []);
  });

  it('prefers agentAccounts even when importedAccounts is also non-empty', () => {
    const result = selectClaudeAccountsSource([AGENT_ACCOUNT], [IMPORTED_ACCOUNT]);
    assert.equal(result.authSource, 'agent-store');
  });

  it('returns all agentAccounts when multiple exist', () => {
    const accounts = [AGENT_ACCOUNT, { ...AGENT_ACCOUNT, accountKey: 'b' }];
    const result = selectClaudeAccountsSource(accounts, []);
    assert.deepEqual(result.accounts, accounts);
  });
});
