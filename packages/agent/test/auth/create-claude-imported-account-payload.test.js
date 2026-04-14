import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createClaudeImportedAccountPayload } from '../../src/auth/create-claude-imported-account-payload.js';

const NOW = '2024-06-01T00:00:00.000Z';

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
