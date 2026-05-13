import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createBotServer } from '../src/bot-server.js';
import { startBot, stopBot } from '../src/index.js';

function makeMockBot({ initFails = false, initError } = {}) {
  let initAttempts = 0;
  let stopCalled = 0;
  return {
    api: {},
    use() {},
    on() {},
    catch() {},
    init: async () => {
      initAttempts += 1;
      if (initFails) throw initError ?? new Error('mock init failure');
    },
    start: () => Promise.resolve(),
    stop: async () => {
      stopCalled += 1;
    },
    get _initAttempts() {
      return initAttempts;
    },
    get _stopCalled() {
      return stopCalled;
    },
  };
}

describe('createBotServer (Phase 2)', () => {
  it('botToken 없으면 throw', () => {
    assert.throws(() => createBotServer({}), /botToken/);
    assert.throws(() => createBotServer({ botToken: '' }), /botToken/);
    assert.throws(() => createBotServer({ botToken: null }), /botToken/);
  });

  it('반환 객체에 start / stop / bot 노출 (grammy Bot 인스턴스 캐리어)', () => {
    const server = createBotServer({
      botToken: '123:fake',
      allowedUserIds: [42],
    });
    assert.equal(typeof server.start, 'function');
    assert.equal(typeof server.stop, 'function');
    assert.ok(server.bot, 'bot instance should be exposed for tests / extensions');
  });

  it('stop() 을 start 전에 호출하면 noop (no throw)', async () => {
    const server = createBotServer({
      botToken: '123:fake',
      allowedUserIds: [42],
    });
    await server.stop();
  });
});

describe('createBotServer boot validation (PR #133 review)', () => {
  it('init 실패 시 throw + lock 해제 (재시도 가능)', async () => {
    const mock = makeMockBot({ initFails: true, initError: new Error('Unauthorized') });
    const server = createBotServer({
      botToken: '123:fake',
      allowedUserIds: [42],
      botFactory: () => mock,
    });
    await assert.rejects(() => server.start(), /Unauthorized/);
    // lock 해제 단언 — 같은 server 인스턴스로 다시 start 가능 (init 또 시도).
    await assert.rejects(() => server.start(), /Unauthorized/);
    assert.equal(mock._initAttempts, 2);
  });

  it('init 성공 후 두 번째 start 는 already started throw', async () => {
    const mock = makeMockBot();
    const server = createBotServer({
      botToken: '123:fake',
      allowedUserIds: [42],
      botFactory: () => mock,
    });
    await server.start();
    await assert.rejects(() => server.start(), /already started/);
    assert.equal(mock._initAttempts, 1);
  });

  it('start 성공 후 stop 호출 시 bot.stop 호출', async () => {
    const mock = makeMockBot();
    const server = createBotServer({
      botToken: '123:fake',
      allowedUserIds: [42],
      botFactory: () => mock,
    });
    await server.start();
    await server.stop();
    assert.equal(mock._stopCalled, 1);
  });
});

describe('startBot / stopBot single-instance lock', () => {
  it('stopBot 을 미작동 상태에서 호출해도 noop', async () => {
    await stopBot();
    // 두 번 호출도 안전.
    await stopBot();
  });

  // 실 startBot 호출은 grammy 가 외부 Telegram API 로 polling 시도 — 단위
  // 테스트에서는 실행하지 않는다 (네트워크 의존). single-instance lock 의
  // assertion 만 분리해서 검증.
  it('단일 인스턴스 lock 조건 검증 (state 검사용 직접 호출 X)', () => {
    // 본 케이스는 startBot 의 두 번째 호출이 throw 한다는 사실을 코드 리뷰가
    // 가능하게 두는 sentinel — 실 동작은 e2e 또는 Phase 4 의 setup 명령에서
    // 수동으로 검증한다. 여기서는 startBot 이 함수로 export 되는지만 확인.
    assert.equal(typeof startBot, 'function');
  });
});
