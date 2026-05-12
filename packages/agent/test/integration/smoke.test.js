import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const BIN = path.resolve(__dirname, '../../bin/token-weather.js');

/**
 * Run the CLI in a clean tmp HOME so it never touches the real auth.json /
 * Claude credentials. We accept that some commands (status / doctor) may
 * attempt network calls; those should fail or produce empty results without
 * crashing the process.
 */
function runCli(args, { timeoutMs = 20_000 } = {}) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-usage-smoke-'));
  try {
    const result = spawnSync('node', [BIN, ...args], {
      env: { ...process.env, HOME: tmpHome, NO_COLOR: '1' },
      encoding: 'utf8',
      timeout: timeoutMs,
    });
    return result;
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
}

describe('bin/token-weather — smoke', () => {
  it('exits 0 with usage-like output when called without args', () => {
    const result = runCli([]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    // stdout 또는 stderr 어디든 사용법 안내가 있어야 함
    const all = result.stdout + result.stderr;
    assert.match(all, /token-weather|usage|status|doctor/i);
  });

  it('config init creates default config in HOME', () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-usage-smoke-init-'));
    try {
      const result = spawnSync('node', [BIN, 'config', 'init'], {
        env: { ...process.env, HOME: tmpHome },
        encoding: 'utf8',
        timeout: 10_000,
      });
      assert.equal(result.status, 0, `stderr: ${result.stderr}`);
      const expected = path.join(tmpHome, '.config', 'token-weather', 'config.json');
      assert.ok(fs.existsSync(expected), 'config.json should be created');
      const parsed = JSON.parse(fs.readFileSync(expected, 'utf8'));
      assert.ok(parsed.providers);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it('auth logout without provider prints usage and exits non-zero', () => {
    const result = runCli(['auth', 'logout'], { timeoutMs: 10_000 });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /사용법/);
  });

  it('auth login claude --port foo prints validation warning and exits cleanly', () => {
    const result = runCli(['auth', 'login', 'claude', '--port', 'foo'], {
      timeoutMs: 10_000,
    });
    // exit code is 0 (returns early after warning), warning goes to stderr
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stderr, /--port 값 "foo"/);
    assert.match(result.stderr, /login을 중단합니다/);
  });

  it('status --account <unknown> exits cleanly and prints filter line', () => {
    const result = runCli(['status', '--account', 'definitely-not-an-account'], {
      timeoutMs: 15_000,
    });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /Account filter: definitely-not-an-account/);
  });

  it('status --json emits a single parseable JSON line on stdout', () => {
    const result = runCli(['status', '--json'], { timeoutMs: 15_000 });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    // stdout은 정확히 한 줄(JSON + 단일 trailing newline)이어야 한다.
    const lines = result.stdout.split('\n').filter((l) => l.length > 0);
    assert.equal(lines.length, 1, `stdout had ${lines.length} non-empty lines`);
    assert.doesNotThrow(() => JSON.parse(lines[0]));
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.command, 'status');
    assert.ok(Array.isArray(parsed.providers));
    // 텍스트 헤더("━━━━ Agent Status Summary ━━━━" 등) 는 stdout 에 절대 섞이지 않아야 함.
    assert.equal(result.stdout.includes('Agent Status Summary'), false);
  });

  it('status --json --provider codex restricts providers array to codex only', () => {
    const result = runCli(['status', '--json', '--provider', 'codex'], {
      timeoutMs: 15_000,
    });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout.trim());
    assert.deepEqual(
      parsed.providers.map((p) => p.id),
      ['codex'],
    );
    assert.equal(parsed.providerFilter, 'codex');
  });
});
