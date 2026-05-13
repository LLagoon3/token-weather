import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { authAllowlistMiddleware, maskChatId } from '../src/auth-allowlist.js';

function buildCtx(fromId) {
  return { from: { id: fromId } };
}

function makeNextSpy() {
  let called = 0;
  return {
    fn: async () => {
      called += 1;
    },
    get called() {
      return called;
    },
  };
}

function makeLogger() {
  const logs = [];
  return {
    logger: {
      log: (msg) => {
        logs.push(msg);
      },
    },
    logs,
  };
}

describe('authAllowlistMiddleware', () => {
  it('허용 chat_id 는 next() 호출', async () => {
    const { logger, logs } = makeLogger();
    const mw = authAllowlistMiddleware([42], { logger });
    const next = makeNextSpy();
    await mw(buildCtx(42), next.fn);
    assert.equal(next.called, 1);
    assert.equal(logs.length, 0);
  });

  it('미허용 chat_id 는 silent ignore (next() 호출 안 됨, 로그만)', async () => {
    const { logger, logs } = makeLogger();
    const mw = authAllowlistMiddleware([42], { logger });
    const next = makeNextSpy();
    await mw(buildCtx(99), next.fn);
    assert.equal(next.called, 0);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /미허용 chat_id/);
  });

  it('string / number id 혼용도 같은 값으로 매칭', async () => {
    const { logger } = makeLogger();
    const mw = authAllowlistMiddleware(['42'], { logger });
    const next = makeNextSpy();
    await mw(buildCtx(42), next.fn);
    assert.equal(next.called, 1);
  });

  it('빈 allowlist 는 모든 발신자 거부', async () => {
    const { logger } = makeLogger();
    const mw = authAllowlistMiddleware([], { logger });
    const next = makeNextSpy();
    await mw(buildCtx(42), next.fn);
    assert.equal(next.called, 0);
  });

  it('null / undefined allowlist 도 안전 (모두 거부)', async () => {
    const { logger } = makeLogger();
    const mw1 = authAllowlistMiddleware(null, { logger });
    const mw2 = authAllowlistMiddleware(undefined, { logger });
    const next = makeNextSpy();
    await mw1(buildCtx(42), next.fn);
    await mw2(buildCtx(42), next.fn);
    assert.equal(next.called, 0);
  });

  it('ctx.from 자체가 없으면 silent ignore (로그도 안 남김)', async () => {
    const { logger, logs } = makeLogger();
    const mw = authAllowlistMiddleware([42], { logger });
    const next = makeNextSpy();
    await mw({}, next.fn);
    assert.equal(next.called, 0);
    assert.equal(logs.length, 0);
  });
});

describe('maskChatId', () => {
  it('4 자 이하는 전체 마스킹', () => {
    assert.equal(maskChatId('42'), '****');
    assert.equal(maskChatId('1234'), '****');
  });

  it('5 자 이상은 앞 3 / 뒤 2 만 노출', () => {
    assert.equal(maskChatId('1234567890'), '123****90');
    assert.equal(maskChatId('8308098400'), '830****00');
  });

  it('number 입력도 string 처리', () => {
    assert.equal(maskChatId(8308098400), '830****00');
  });
});
