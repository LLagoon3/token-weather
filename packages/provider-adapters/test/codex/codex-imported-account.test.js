import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildImportedCodexAccount,
  resolveImportedCodexAccounts,
  selectCodexAccountsSource,
  resolveImportedCodexSnapshot,
} from '../../src/codex/codex-imported-account.js';

const VALID_TOKENS = {
  id_token: 'jwt-1',
  access_token: 'at',
  refresh_token: 'rt',
  account_id: 'acc-1',
};

describe('buildImportedCodexAccount', () => {
  it('null tokens → null', () => {
    assert.equal(buildImportedCodexAccount(null), null);
  });

  it('access_token 부재 → null', () => {
    assert.equal(buildImportedCodexAccount({ id_token: 'x' }), null);
  });

  it('정상 tokens → import account record', () => {
    const account = buildImportedCodexAccount(VALID_TOKENS);
    assert.equal(account.provider, 'codex');
    assert.equal(account.source, 'codex-cli-import');
    assert.equal(account.accountKey, 'codex-cli-import');
    assert.equal(account.authType, 'oauth');
    assert.equal(account.accessToken, 'at');
    assert.equal(account.refreshToken, 'rt');
    assert.equal(account.idToken, 'jwt-1');
    assert.equal(account.accountId, 'acc-1');
  });
});

describe('resolveImportedCodexAccounts', () => {
  it('정상 tokens → length 1', () => {
    const list = resolveImportedCodexAccounts(VALID_TOKENS);
    assert.equal(list.length, 1);
  });

  it('null tokens → []', () => {
    assert.deepEqual(resolveImportedCodexAccounts(null), []);
  });
});

describe('selectCodexAccountsSource', () => {
  it('agent-store 우선 (length > 0)', () => {
    const result = selectCodexAccountsSource([{ id: 'a' }], [{ id: 'b' }]);
    assert.equal(result.authSource, 'agent-store');
    assert.equal(result.accounts.length, 1);
    assert.equal(result.accounts[0].id, 'a');
  });

  it('agent-store 비었으면 codex-cli-import', () => {
    const result = selectCodexAccountsSource([], [{ id: 'b' }]);
    assert.equal(result.authSource, 'codex-cli-import');
    assert.equal(result.accounts[0].id, 'b');
  });

  it('둘 다 비었으면 not-found', () => {
    const result = selectCodexAccountsSource([], []);
    assert.equal(result.authSource, 'not-found');
    assert.deepEqual(result.accounts, []);
  });
});

describe('resolveImportedCodexSnapshot', () => {
  it('정상 tokens → codex-cli-import + 1 account', () => {
    const result = resolveImportedCodexSnapshot(VALID_TOKENS);
    assert.equal(result.authSource, 'codex-cli-import');
    assert.equal(result.accounts.length, 1);
    assert.equal(result.accounts[0].source, 'codex-cli-import');
  });

  it('null tokens → not-found + 빈 list', () => {
    const result = resolveImportedCodexSnapshot(null);
    assert.equal(result.authSource, 'not-found');
    assert.deepEqual(result.accounts, []);
  });
});
