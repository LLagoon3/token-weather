import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BOT_COMMANDS, formatHelpText } from '../src/bot-commands.js';

describe('BOT_COMMANDS', () => {
  it('frozen array (외부 변경 차단)', () => {
    assert.ok(Object.isFrozen(BOT_COMMANDS), 'BOT_COMMANDS 자체가 frozen');
    for (const entry of BOT_COMMANDS) {
      assert.ok(Object.isFrozen(entry), `entry frozen: ${entry.command}`);
    }
  });

  it('Telegram BotCommand 형식 (command + description) 만 포함', () => {
    for (const entry of BOT_COMMANDS) {
      assert.equal(typeof entry.command, 'string');
      assert.equal(typeof entry.description, 'string');
      assert.deepEqual(Object.keys(entry).sort(), ['command', 'description']);
    }
  });

  it('Telegram 제약: command 는 1–32자 [a-z0-9_], description 은 1–256자', () => {
    for (const { command, description } of BOT_COMMANDS) {
      assert.match(command, /^[a-z0-9_]+$/, `command 글자 set: ${command}`);
      assert.ok(command.length >= 1 && command.length <= 32, `command 길이: ${command}`);
      assert.ok(
        description.length >= 1 && description.length <= 256,
        `description 길이: ${description}`,
      );
    }
  });

  it('중복 command 없음', () => {
    const names = BOT_COMMANDS.map((c) => c.command);
    assert.equal(new Set(names).size, names.length, '중복 명령 금지');
  });

  it('MVP 5 명령이 모두 포함 (status / usage / doctor / auth_list / help)', () => {
    const names = new Set(BOT_COMMANDS.map((c) => c.command));
    for (const expected of ['status', 'usage', 'doctor', 'auth_list', 'help']) {
      assert.ok(names.has(expected), `명령 누락: ${expected}`);
    }
  });
});

describe('formatHelpText', () => {
  it('첫 줄은 "Token Weather 봇 명령:" + 빈 줄 + 각 명령 한 줄씩', () => {
    const text = formatHelpText();
    const lines = text.split('\n');
    assert.equal(lines[0], 'Token Weather 봇 명령:');
    assert.equal(lines[1], '');
    assert.equal(lines.length, 2 + BOT_COMMANDS.length);
  });

  it('각 명령 라인은 "/cmd ... — description" 형식 + command 폭 padEnd', () => {
    const text = formatHelpText();
    const maxCmdLen = Math.max(...BOT_COMMANDS.map((c) => c.command.length));
    for (const { command, description } of BOT_COMMANDS) {
      const expected = `/${command.padEnd(maxCmdLen)}  — ${description}`;
      assert.ok(
        text.includes(expected),
        `라인 누락:\nexpected: ${JSON.stringify(expected)}\nactual: ${JSON.stringify(text)}`,
      );
    }
  });

  it('빈 commands 배열 → fallback 안내', () => {
    const text = formatHelpText([]);
    assert.match(text, /등록된 명령 없음/);
  });

  it('사용자 정의 commands 배열 전달 시 그 배열만 사용', () => {
    const custom = [{ command: 'foo', description: 'bar' }];
    const text = formatHelpText(custom);
    assert.ok(text.includes('/foo  — bar'));
    assert.ok(!text.includes('/status'));
  });

  it('HTML / <pre> 미사용 (모바일 reflow 의도)', () => {
    const text = formatHelpText();
    for (const tag of ['<pre>', '</pre>', '<b>', '<i>', '<code>']) {
      assert.ok(!text.includes(tag), `${tag} 미포함 기대`);
    }
  });
});
