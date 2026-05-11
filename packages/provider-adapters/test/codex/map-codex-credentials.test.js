import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mapCodexCredentials } from '../../src/codex/map-codex-credentials.js';

describe('mapCodexCredentials', () => {
  it('null / non-object → null', () => {
    assert.equal(mapCodexCredentials(null), null);
    assert.equal(mapCodexCredentials(undefined), null);
    assert.equal(mapCodexCredentials('s'), null);
  });

  it('access_token 이 없으면 null', () => {
    assert.equal(mapCodexCredentials({}), null);
    assert.equal(mapCodexCredentials({ id_token: 'jwt' }), null);
  });

  it('정상 입력 → 정규화 shape', () => {
    const tokens = {
      id_token: 'jwt-1',
      access_token: 'at',
      refresh_token: 'rt',
      account_id: 'acc-1',
    };
    const result = mapCodexCredentials(tokens);
    assert.deepEqual(result, {
      provider: 'codex',
      accessToken: 'at',
      refreshToken: 'rt',
      idToken: 'jwt-1',
      accountId: 'acc-1',
    });
  });

  it('refresh_token / id_token / account_id 가 없어도 access_token 만 있으면 OK', () => {
    const result = mapCodexCredentials({ access_token: 'at-only' });
    assert.equal(result.accessToken, 'at-only');
    assert.equal(result.refreshToken, null);
    assert.equal(result.idToken, null);
    assert.equal(result.accountId, null);
  });
});
