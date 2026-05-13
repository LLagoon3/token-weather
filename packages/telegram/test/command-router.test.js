import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseCommand, listAvailableCommands } from '../src/command-router.js';

describe('parseCommand', () => {
  it('slash + cmd → { cmd, args: [] }', () => {
    assert.deepEqual(parseCommand('/status'), { cmd: 'status', args: [] });
  });

  it('slash + cmd + args → split on whitespace', () => {
    assert.deepEqual(parseCommand('/status --json --account work'), {
      cmd: 'status',
      args: ['--json', '--account', 'work'],
    });
  });

  it('group chat mention suffix /cmd@MyBot 은 제거 (botUsername 미지정 — 기존 동작)', () => {
    assert.deepEqual(parseCommand('/status@TokenWeatherBot'), {
      cmd: 'status',
      args: [],
    });
  });

  it('botUsername 일치 시 통과 (case-insensitive)', () => {
    assert.deepEqual(parseCommand('/status@TokenWeatherBot', { botUsername: 'TokenWeatherBot' }), {
      cmd: 'status',
      args: [],
    });
    assert.deepEqual(parseCommand('/status@TokenWeatherBot', { botUsername: 'tokenweatherbot' }), {
      cmd: 'status',
      args: [],
    });
  });

  it('다른 봇 mention 은 null (group chat 명령 충돌 방지 — PR #133 review)', () => {
    assert.equal(parseCommand('/status@OtherBot', { botUsername: 'TokenWeatherBot' }), null);
  });

  it('mention 없는 명령은 botUsername 지정 시에도 통과', () => {
    assert.deepEqual(parseCommand('/status', { botUsername: 'TokenWeatherBot' }), {
      cmd: 'status',
      args: [],
    });
  });

  it('lowercase 로 정규화 (/Status → status)', () => {
    assert.deepEqual(parseCommand('/Status'), { cmd: 'status', args: [] });
    assert.deepEqual(parseCommand('/USAGE'), { cmd: 'usage', args: [] });
  });

  it('leading / trailing 공백 trim', () => {
    assert.deepEqual(parseCommand('   /status   '), { cmd: 'status', args: [] });
  });

  it('non-command 입력은 null', () => {
    assert.equal(parseCommand('hello'), null);
    assert.equal(parseCommand(''), null);
    assert.equal(parseCommand('/'), null);
    assert.equal(parseCommand('  '), null);
  });

  it('non-string 은 null', () => {
    assert.equal(parseCommand(null), null);
    assert.equal(parseCommand(undefined), null);
    assert.equal(parseCommand(123), null);
    assert.equal(parseCommand({}), null);
  });
});

describe('listAvailableCommands', () => {
  it('dispatcher 가 비어 있으면 "Phase 3 머지 후 활성화" 안내', () => {
    assert.match(listAvailableCommands({}), /Phase 3/);
    assert.match(listAvailableCommands(null), /Phase 3/);
    assert.match(listAvailableCommands(undefined), /Phase 3/);
  });

  it('dispatcher 키를 /cmd 형식으로 정렬해 표시', () => {
    const result = listAvailableCommands({
      usage: () => {},
      status: () => {},
      doctor: () => {},
    });
    assert.equal(result, '/doctor /status /usage');
  });
});
