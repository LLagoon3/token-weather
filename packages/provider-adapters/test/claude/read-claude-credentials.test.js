import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  parseClaudeCredentials,
  resolveClaudeCredentialsPath,
  readClaudeCredentials,
} from '../../src/claude/read-claude-credentials.js';

describe('parseClaudeCredentials', () => {
  it('extracts claudeAiOauth from a valid object', () => {
    const oauth = { accessToken: 'tok', refreshToken: 'ref' };
    const result = parseClaudeCredentials({ claudeAiOauth: oauth });
    assert.deepEqual(result, oauth);
  });

  it('returns null for null input', () => {
    assert.equal(parseClaudeCredentials(null), null);
  });

  it('returns null for non-object input', () => {
    assert.equal(parseClaudeCredentials('string'), null);
    assert.equal(parseClaudeCredentials(42), null);
  });

  it('returns null when claudeAiOauth is missing', () => {
    assert.equal(parseClaudeCredentials({}), null);
    assert.equal(parseClaudeCredentials({ other: 'field' }), null);
  });

  it('returns null when claudeAiOauth is not an object', () => {
    assert.equal(parseClaudeCredentials({ claudeAiOauth: null }), null);
    assert.equal(parseClaudeCredentials({ claudeAiOauth: 'string' }), null);
    assert.equal(parseClaudeCredentials({ claudeAiOauth: 123 }), null);
  });
});

describe('resolveClaudeCredentialsPath', () => {
  it('joins base path with .claude/.credentials.json', () => {
    const result = resolveClaudeCredentialsPath('/home/user');
    assert.equal(result, path.join('/home/user', '.claude', '.credentials.json'));
  });

  it('defaults to os.homedir() when no base is given', () => {
    const result = resolveClaudeCredentialsPath();
    assert.equal(result, path.join(os.homedir(), '.claude', '.credentials.json'));
  });
});

describe('readClaudeCredentials', () => {
  it('returns null when file does not exist', () => {
    const nonExistent = path.join(os.tmpdir(), `no-such-file-${Date.now()}.json`);
    assert.equal(readClaudeCredentials(nonExistent), null);
  });

  it('reads and parses a valid credentials file', () => {
    const oauth = { accessToken: 'at', refreshToken: 'rt', expiresAt: 9999 };
    const tmpFile = path.join(os.tmpdir(), `claude-creds-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ claudeAiOauth: oauth }), 'utf8');
    try {
      const result = readClaudeCredentials(tmpFile);
      assert.deepEqual(result, oauth);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('returns null when file exists but claudeAiOauth is missing', () => {
    const tmpFile = path.join(os.tmpdir(), `claude-creds-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ other: 'data' }), 'utf8');
    try {
      assert.equal(readClaudeCredentials(tmpFile), null);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
