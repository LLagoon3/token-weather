import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatClaudeSection } from '../../src/cli/doctor-command.js';

// ---------------------------------------------------------------------------
// formatClaudeSection — pure display helper
// ---------------------------------------------------------------------------

describe('formatClaudeSection', () => {
  const FAKE_PATH = '/home/user/.claude/.credentials.json';

  it('includes credentialsPath in output', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      authSource: 'claude-cli-import',
      importedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes(FAKE_PATH)));
  });

  it('shows found=true and parsed=true when credentials exist', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      authSource: 'claude-cli-import',
      importedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('found') && l.includes('true')));
    assert.ok(lines.some((l) => l.includes('parsed') && l.includes('true')));
    assert.ok(lines.some((l) => l.includes('authSource') && l.includes('claude-cli-import')));
  });

  it('shows found=false and parsed=false when credentials are absent', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
      authSource: 'claude-cli-import',
      importedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('found') && l.includes('false')));
    assert.ok(lines.some((l) => l.includes('parsed') && l.includes('false')));
  });

  it('returns an array with at least 4 lines', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
      authSource: 'claude-cli-import',
      importedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.length >= 4);
  });

  it('shows accountKey when importedAccount is present', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: true,
      parsed: true,
      authSource: 'claude-cli-import',
      importedAccount: { accountKey: 'claude-cli-import', authType: 'oauth' },
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(lines.some((l) => l.includes('accountKey') && l.includes('claude-cli-import')));
  });

  it('omits accountKey line when importedAccount is null', () => {
    const snapshot = {
      credentialsPath: FAKE_PATH,
      found: false,
      parsed: false,
      authSource: 'claude-cli-import',
      importedAccount: null,
    };
    const lines = formatClaudeSection(snapshot);
    assert.ok(!lines.some((l) => l.includes('accountKey')));
  });
});
