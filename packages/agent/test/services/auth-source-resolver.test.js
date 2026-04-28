import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveAuthSource } from '../../src/services/auth-source-resolver.js';

describe('resolveAuthSource', () => {
  it('returns agent-store when agentAccounts is non-empty', () => {
    const result = resolveAuthSource(
      [{ id: 'agent-1' }],
      [{ id: 'openclaw-import', accounts: [{ id: 'oc-1' }] }],
    );
    assert.equal(result.authSource, 'agent-store');
    assert.deepEqual(result.accounts, [{ id: 'agent-1' }]);
  });

  it('falls back to first non-empty import source', () => {
    const result = resolveAuthSource([], [{ id: 'openclaw-import', accounts: [{ id: 'oc-1' }] }]);
    assert.equal(result.authSource, 'openclaw-import');
    assert.deepEqual(result.accounts, [{ id: 'oc-1' }]);
  });

  it('skips empty import sources and uses the first non-empty one', () => {
    const result = resolveAuthSource(
      [],
      [
        { id: 'empty-source', accounts: [] },
        { id: 'claude-cli-import', accounts: [{ id: 'cli-1' }] },
      ],
    );
    assert.equal(result.authSource, 'claude-cli-import');
    assert.deepEqual(result.accounts, [{ id: 'cli-1' }]);
  });

  it('returns not-found when all sources are empty', () => {
    const result = resolveAuthSource([], []);
    assert.equal(result.authSource, 'not-found');
    assert.deepEqual(result.accounts, []);
  });

  it('returns not-found when agentAccounts is empty and no importSources provided', () => {
    const result = resolveAuthSource([]);
    assert.equal(result.authSource, 'not-found');
  });

  it('handles null/undefined agentAccounts gracefully', () => {
    const result = resolveAuthSource(null, [{ id: 'x', accounts: [{ id: 'a' }] }]);
    assert.equal(result.authSource, 'x');
  });

  it('prefers agent-store even when import sources also have accounts', () => {
    const agent = [{ id: 'a1' }, { id: 'a2' }];
    const result = resolveAuthSource(agent, [
      { id: 'openclaw-import', accounts: [{ id: 'oc' }] },
      { id: 'claude-cli-import', accounts: [{ id: 'cli' }] },
    ]);
    assert.equal(result.authSource, 'agent-store');
    assert.equal(result.accounts.length, 2);
  });
});
