import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDoctorCodexHelp,
  formatDoctorClaudeHelp,
} from '../../src/cli/doctor-command.js';

describe('doctor 옵션 spec — --dedupe 관련', () => {
  it('codex --help 텍스트에 --dedupe / --apply / --backfill-account-id 가 노출됨', () => {
    const text = formatDoctorCodexHelp().join('\n');
    assert.match(text, /--dedupe/);
    assert.match(text, /--apply/);
    assert.match(text, /--backfill-account-id/);
  });

  it('claude --help 텍스트에도 --dedupe / --apply / --backfill-account-id 가 노출됨', () => {
    const text = formatDoctorClaudeHelp().join('\n');
    assert.match(text, /--dedupe/);
    assert.match(text, /--apply/);
    assert.match(text, /--backfill-account-id/);
  });
});
