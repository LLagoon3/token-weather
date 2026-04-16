import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runConfigInitCommand } from '../../src/cli/config-init-command.js';

let tmpHome;
let originalHome;
let originalLog;
let logged;

function withTmpHome() {
  before(() => {
    originalHome = process.env.HOME;
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-usage-config-'));
    process.env.HOME = tmpHome;
    originalLog = console.log;
    logged = [];
    console.log = (...args) => logged.push(args.join(' '));
  });
  after(() => {
    console.log = originalLog;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });
}

describe('runConfigInitCommand — fresh init', () => {
  withTmpHome();

  it('creates ~/.config/ai-usage-agent/config.json with default contents', async () => {
    await runConfigInitCommand();

    const configPath = path.join(tmpHome, '.config', 'ai-usage-agent', 'config.json');
    assert.ok(fs.existsSync(configPath), 'config file should exist');

    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    assert.ok(parsed.providers);
    assert.equal(parsed.providers.codex.enabled, true);
    assert.equal(parsed.providers.claude.enabled, true);
    assert.equal(typeof parsed.sync, 'object');
  });

  it('logs the created file path', async () => {
    // 이전 it에 의존하지 않도록 자체적으로 커맨드를 재실행하고 로그도 reset 후 검증.
    logged.length = 0;
    await runConfigInitCommand();
    assert.ok(logged.some((l) => l.includes('기본 설정 파일을 생성했습니다')));
    assert.ok(logged.some((l) => l.includes('config.json')));
  });
});

describe('runConfigInitCommand — overwrite behavior', () => {
  withTmpHome();

  it('overwrites existing file (current contract — caller responsible for backup)', async () => {
    const configPath = path.join(tmpHome, '.config', 'ai-usage-agent', 'config.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, '{"custom":"value"}');

    await runConfigInitCommand();

    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(parsed.custom, undefined);
    assert.ok(parsed.providers);
  });
});
