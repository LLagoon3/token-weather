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
  it('starts with the "ai-usage-agent" header', () => {
    assert.equal(formatGlobalHelp()[0], 'ai-usage-agent');
  });

  it('lists every top-level subcommand one-liner', () => {
    const body = formatGlobalHelp().join('\n');
    assert.match(body, /ai-usage-agent status/);
    assert.match(body, /ai-usage-agent usage/);
    assert.match(body, /ai-usage-agent doctor/);
    assert.match(body, /ai-usage-agent config init/);
    assert.match(body, /ai-usage-agent auth login/);
    assert.match(body, /ai-usage-agent auth list/);
    assert.match(body, /ai-usage-agent auth import/);
    assert.match(body, /ai-usage-agent auth logout/);
  });

  it('hints at <command> --help for detailed options', () => {
    assert.match(formatGlobalHelp().join('\n'), /<command> --help/);
  });
});

describe('runCli — global --help', () => {
  it('prints global help when invoked with --help as first arg', async () => {
    const lines = await captureOutput(() => runCli(['--help']));
    assert.equal(lines[0], 'ai-usage-agent');
  });

  it('prints global help when invoked with -h as first arg', async () => {
    const lines = await captureOutput(() => runCli(['-h']));
    assert.equal(lines[0], 'ai-usage-agent');
  });

  it('prints global help when no command matches (fallback)', async () => {
    const lines = await captureOutput(() => runCli(['nope']));
    assert.equal(lines[0], 'ai-usage-agent');
  });
});

describe('runCli — doctor --help at subcommand position', () => {
  it('prints doctor root help when subcommand is --help', async () => {
    const lines = await captureOutput(() => runCli(['doctor', '--help']));
    assert.match(lines[0], /^ai-usage-agent doctor \[subcommand\]/);
  });

  it('also honors -h at subcommand position', async () => {
    const lines = await captureOutput(() => runCli(['doctor', '-h']));
    assert.match(lines[0], /^ai-usage-agent doctor \[subcommand\]/);
  });
});
