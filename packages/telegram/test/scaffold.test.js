import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runTelegramCommand, formatTelegramHelp } from '../src/index.js';

describe('@token-weather/telegram public API (Phase 1 scaffold → Phase 3 evolution)', () => {
  it('runTelegramCommand 는 비동기 함수로 export 된다', () => {
    assert.equal(typeof runTelegramCommand, 'function');
  });

  it('argv + deps 두 인자 시그니처 — start 진입 시 deps.resolveAgentConfigPath 가 필요', async () => {
    await assert.rejects(() => runTelegramCommand([], {}), /resolveAgentConfigPath/);
  });

  it('--help / -h 는 throw 없이 안내 출력', async () => {
    const orig = console.log;
    const logs = [];
    console.log = (...a) => logs.push(a.join(' '));
    try {
      await runTelegramCommand(['--help'], {});
      await runTelegramCommand(['-h'], {});
    } finally {
      console.log = orig;
    }
    assert.ok(logs.some((l) => l.includes('Telegram 봇 daemon')));
  });

  it('formatTelegramHelp 가 start 서브명령을 안내한다', () => {
    const lines = formatTelegramHelp();
    assert.match(lines[0], /^token-weather telegram/);
    assert.ok(lines.some((l) => l.includes('start')));
  });

  it('telegram start --help 는 throw 없이 안내 출력 (PR #134 review)', async () => {
    const orig = console.log;
    const logs = [];
    console.log = (...a) => logs.push(a.join(' '));
    try {
      await runTelegramCommand(['start', '--help'], {});
      await runTelegramCommand(['start', '-h'], {});
    } finally {
      console.log = orig;
    }
    assert.ok(logs.some((l) => l.includes('telegram start')));
    assert.ok(logs.some((l) => l.includes('활성화 사전 조건')));
  });
});
