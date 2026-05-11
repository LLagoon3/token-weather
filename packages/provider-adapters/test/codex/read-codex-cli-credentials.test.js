import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  resolveCodexCliCredentialsPath,
  parseCodexCliCredentials,
  readCodexCliCredentials,
  getDefaultCodexCliCredentialsPath,
} from '../../src/codex/read-codex-cli-credentials.js';

describe('resolveCodexCliCredentialsPath', () => {
  it('default base 일 때 ~/.codex/auth.json 경로 반환', () => {
    const expected = path.join(os.homedir(), '.codex', 'auth.json');
    assert.equal(resolveCodexCliCredentialsPath(), expected);
  });

  it('custom base 를 받아 경로 조립', () => {
    assert.equal(
      resolveCodexCliCredentialsPath('/tmp/fake-home'),
      '/tmp/fake-home/.codex/auth.json',
    );
  });
});

describe('parseCodexCliCredentials', () => {
  it('null / non-object 입력 → null', () => {
    assert.equal(parseCodexCliCredentials(null), null);
    assert.equal(parseCodexCliCredentials(undefined), null);
    assert.equal(parseCodexCliCredentials('string'), null);
  });

  it('tokens 객체가 없으면 null', () => {
    assert.equal(parseCodexCliCredentials({}), null);
    assert.equal(parseCodexCliCredentials({ tokens: null }), null);
  });

  it('tokens.access_token 이 없으면 null', () => {
    assert.equal(parseCodexCliCredentials({ tokens: {} }), null);
    assert.equal(parseCodexCliCredentials({ tokens: { id_token: 'jwt' } }), null);
  });

  it('정상 입력 시 tokens 객체 반환', () => {
    const tokens = {
      id_token: 'jwt-1',
      access_token: 'at',
      refresh_token: 'rt',
      account_id: 'acc-1',
    };
    const result = parseCodexCliCredentials({ tokens, auth_mode: 'oauth' });
    assert.deepEqual(result, tokens);
  });
});

describe('readCodexCliCredentials', () => {
  it('파일이 없으면 null', () => {
    assert.equal(readCodexCliCredentials('/tmp/non-existent-codex-auth.json'), null);
  });

  it('JSON 파싱 실패 시 null (회귀 가드)', () => {
    const tmpFile = path.join(os.tmpdir(), `codex-auth-broken-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, '{not-valid-json');
    try {
      assert.equal(readCodexCliCredentials(tmpFile), null);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('정상 파일에서 tokens 반환', () => {
    const tmpFile = path.join(os.tmpdir(), `codex-auth-ok-${Date.now()}.json`);
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({
        auth_mode: 'oauth',
        tokens: {
          id_token: 'jwt-1',
          access_token: 'at',
          refresh_token: 'rt',
          account_id: 'acc-1',
        },
      }),
    );
    try {
      const result = readCodexCliCredentials(tmpFile);
      assert.equal(result.access_token, 'at');
      assert.equal(result.refresh_token, 'rt');
      assert.equal(result.account_id, 'acc-1');
      assert.equal(result.id_token, 'jwt-1');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});

describe('getDefaultCodexCliCredentialsPath', () => {
  it('default 경로를 반환 (HOME 기준)', () => {
    const p = getDefaultCodexCliCredentialsPath();
    assert.match(p, /\/\.codex\/auth\.json$/);
  });
});
