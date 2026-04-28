import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fetchClaudeOauthProfile } from '../../src/claude/fetch-claude-oauth-profile.js';

function jsonResponse({ status = 200, body = {} } = {}) {
  const text = JSON.stringify(body);
  return {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    ok: status >= 200 && status < 300,
    async text() {
      return text;
    },
    async json() {
      return JSON.parse(text);
    },
  };
}

describe('fetchClaudeOauthProfile', () => {
  it('parses account, organization, application and identity fields', async () => {
    const fetchImpl = async () => jsonResponse({
      body: {
        account: {
          uuid: 'acct-123',
          display_name: '라군',
          full_name: '이석호',
          email: 'lagoon@example.com',
        },
        organization: {
          uuid: 'org-123',
          name: 'Lagoon Org',
        },
        application: {
          uuid: 'app-123',
          name: 'Claude Code',
        },
      },
    });

    const result = await fetchClaudeOauthProfile({
      accessToken: 'token-123',
      fetchImpl,
    });

    assert.equal(result.accountId, 'acct-123');
    assert.equal(result.email, 'lagoon@example.com');
    assert.equal(result.displayName, '라군');
    assert.equal(result.organization.uuid, 'org-123');
    assert.equal(result.application.name, 'Claude Code');
  });

  it('sends User-Agent: token-weather header', async () => {
    let capturedInit = null;
    const fetchImpl = async (_input, init) => {
      capturedInit = init;
      return jsonResponse({ body: { account: { uuid: 'acct-1' } } });
    };
    await fetchClaudeOauthProfile({ accessToken: 'tok', fetchImpl });
    assert.equal(capturedInit.headers['User-Agent'], 'token-weather');
  });

  it('falls back to full_name when display_name is absent', async () => {
    const fetchImpl = async () => jsonResponse({
      body: {
        account: {
          uuid: 'acct-123',
          full_name: '에버다임 IT팀',
          email: 'everdigm@example.com',
        },
      },
    });

    const result = await fetchClaudeOauthProfile({ accessToken: 'token-123', fetchImpl });
    assert.equal(result.displayName, '에버다임 IT팀');
  });

  it('throws descriptive error on non-2xx response', async () => {
    const fetchImpl = async () => jsonResponse({
      status: 403,
      body: {
        error: {
          message: 'OAuth token does not meet scope requirement user:profile',
        },
      },
    });

    await assert.rejects(
      () => fetchClaudeOauthProfile({ accessToken: 'token-123', fetchImpl }),
      /403 .*user:profile/,
    );
  });

  it('throws when accessToken is empty', async () => {
    await assert.rejects(
      () => fetchClaudeOauthProfile({ accessToken: '' }),
      /accessToken이 비어/,
    );
  });
});
