import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatAuthLoginHelp, runAuthLoginCommand } from '../../src/cli/auth-login-command.js';

async function captureOutput(fn) {
  const lines = [];
  const orig = console.log;
  console.log = (...args) => lines.push(args.map(String).join(' '));
  try {
    await fn();
  } finally {
    console.log = orig;
  }
  return lines;
}

describe('formatAuthLoginHelp', () => {
  it('first line is auth login usage', () => {
    assert.match(formatAuthLoginHelp()[0], /^token-weather auth login/);
  });

  it('lists key options (--mock, --port, --timeout, --label, --manual, -h)', () => {
    const body = formatAuthLoginHelp().join('\n');
    assert.match(body, /--mock/);
    assert.match(body, /--port/);
    assert.match(body, /--timeout/);
    assert.match(body, /--label/);
    assert.match(body, /--manual/);
    assert.match(body, /-h, --help/);
  });
});

describe('runAuthLoginCommand — --help', () => {
  it('prints help before provider validation when --help is in args', async () => {
    const lines = await captureOutput(() => runAuthLoginCommand(undefined, ['--help']));
    assert.match(lines[0], /^token-weather auth login/);
  });

  it('prints help when provider is given but args contain --help', async () => {
    // parseLoginOptions가 options.help를 채워 early return이 일어나야 한다.
    const lines = await captureOutput(() => runAuthLoginCommand('codex', ['--help']));
    assert.match(lines[0], /^token-weather auth login/);
  });

  it('prints help when --help is in the provider slot (auth login --help)', async () => {
    // runCli가 provider='--help', args=[]로 전달하는 경로.
    const lines = await captureOutput(() => runAuthLoginCommand('--help', []));
    assert.match(lines[0], /^token-weather auth login/);
  });

  it('also honors -h in the provider slot', async () => {
    const lines = await captureOutput(() => runAuthLoginCommand('-h', []));
    assert.match(lines[0], /^token-weather auth login/);
  });
});
