import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { claudeMapAccountToProfile } from '../../src/services/claude-account-spec.js';

describe('claudeMapAccountToProfile', () => {
  it('preserves account display metadata for formatter consumers', () => {
    const profile = claudeMapAccountToProfile({
      accountKey: 'anthropic-claude:acct-123',
      accountId: 'acct-123',
      email: 'everdigm.itteam@gmail.com',
      displayName: '에버다임 IT팀',
      label: 'work',
      tokens: { accessToken: 'token-123' },
    });

    assert.equal(profile.id, 'anthropic-claude:acct-123');
    assert.equal(profile.accountKey, 'anthropic-claude:acct-123');
    assert.equal(profile.displayName, '에버다임 IT팀');
    assert.equal(profile.email, 'everdigm.itteam@gmail.com');
    assert.equal(profile.label, 'work');
  });
});
