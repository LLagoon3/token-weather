import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runCli, formatGlobalHelp } from '../../src/cli/run-cli.js';

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

describe('formatGlobalHelp', () => {
  it('starts with the "token-weather" header', () => {
    assert.equal(formatGlobalHelp()[0], 'token-weather');
  });

  it('lists every top-level subcommand one-liner', () => {
    const body = formatGlobalHelp().join('\n');
    assert.match(body, /token-weather status/);
    assert.match(body, /token-weather usage/);
    assert.match(body, /token-weather doctor/);
    assert.match(body, /token-weather config init/);
    assert.match(body, /token-weather auth login/);
    assert.match(body, /token-weather auth list/);
    assert.match(body, /token-weather auth import/);
    assert.match(body, /token-weather auth logout/);
  });

  it('hints at <command> --help for detailed options', () => {
    assert.match(formatGlobalHelp().join('\n'), /<command> --help/);
  });
});

describe('runCli — global --help', () => {
  it('prints global help when invoked with --help as first arg', async () => {
    const lines = await captureOutput(() => runCli(['--help']));
    assert.equal(lines[0], 'token-weather');
  });

  it('prints global help when invoked with -h as first arg', async () => {
    const lines = await captureOutput(() => runCli(['-h']));
    assert.equal(lines[0], 'token-weather');
  });

  it('prints global help when no command matches (fallback)', async () => {
    const lines = await captureOutput(() => runCli(['nope']));
    assert.equal(lines[0], 'token-weather');
  });
});

describe('runCli — doctor --help at subcommand position', () => {
  it('prints doctor root help when subcommand is --help', async () => {
    const lines = await captureOutput(() => runCli(['doctor', '--help']));
    assert.match(lines[0], /^token-weather doctor \[subcommand\]/);
  });

  it('also honors -h at subcommand position', async () => {
    const lines = await captureOutput(() => runCli(['doctor', '-h']));
    assert.match(lines[0], /^token-weather doctor \[subcommand\]/);
  });
});
