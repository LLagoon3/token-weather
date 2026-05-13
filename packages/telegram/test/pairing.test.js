import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validateBotToken, generatePairingCode, runPairingBot } from '../src/pairing.js';

describe('validateBotToken (Phase 4)', () => {
  it('비어 있는 token 은 ok=false', async () => {
    const r1 = await validateBotToken('');
    const r2 = await validateBotToken(null);
    assert.equal(r1.ok, false);
    assert.equal(r2.ok, false);
  });

  it('getMe 가 ok=true 응답 시 botInfo 반환', async () => {
    const fetchFn = async (url) => {
      assert.match(url, /\/bot123:fake\/getMe$/);
      return {
        status: 200,
        json: async () => ({ ok: true, result: { username: 'TokenWeatherBot' } }),
      };
    };
    const r = await validateBotToken('123:fake', { fetchFn });
    assert.equal(r.ok, true);
    assert.equal(r.botInfo.username, 'TokenWeatherBot');
  });

  it('getMe 가 ok=false 응답 시 description 을 error 로', async () => {
    const fetchFn = async () => ({
      status: 401,
      json: async () => ({ ok: false, description: 'Unauthorized' }),
    });
    const r = await validateBotToken('123:bad', { fetchFn });
    assert.equal(r.ok, false);
    assert.match(r.error, /Unauthorized/);
  });

  it('fetch 가 throw 하면 ok=false + error', async () => {
    const fetchFn = async () => {
      throw new Error('network down');
    };
    const r = await validateBotToken('123:any', { fetchFn });
    assert.equal(r.ok, false);
    assert.match(r.error, /network down/);
  });
});

describe('generatePairingCode (Phase 4)', () => {
  it('TGW-XXXXXX 형식', () => {
    const code = generatePairingCode();
    assert.match(code, /^TGW-[A-Z2-9]{6}$/);
  });

  it('호출마다 다른 결과 (확률적)', () => {
    const codes = new Set();
    for (let i = 0; i < 20; i++) codes.add(generatePairingCode());
    assert.ok(codes.size > 5, '20 호출 중 적어도 6 개 unique');
  });

  it('혼동되는 문자 (0/1/I/O) 제외', () => {
    // 충분히 많은 호출에서 한 번이라도 등장 시 fail — 확률적이지만 안전 마진.
    for (let i = 0; i < 100; i++) {
      const code = generatePairingCode();
      assert.equal(code.includes('0'), false);
      assert.equal(code.includes('1'), false);
      assert.equal(code.includes('I'), false);
      assert.equal(code.includes('O'), false);
    }
  });
});

function makeMockBot() {
  let messageHandler = null;
  let catchHandler = null;
  let stopped = false;
  let started = false;
  const replies = [];
  return {
    init: async () => {},
    on: (event, handler) => {
      if (event === 'message:text') messageHandler = handler;
    },
    catch: (handler) => {
      catchHandler = handler;
    },
    start: () => new Promise(() => {}), // long-running, never resolves.
    stop: async () => {
      stopped = true;
    },
    // 테스트가 메시지 발사용.
    _fire: async (ctx) => {
      if (!messageHandler) throw new Error('handler not registered');
      await messageHandler(ctx);
    },
    _fireError: (err) => {
      catchHandler?.({ error: err });
    },
    get stopped() {
      return stopped;
    },
    get started() {
      return started;
    },
    get replies() {
      return replies;
    },
  };
}

function makeCtx(text, { from } = {}) {
  const replies = [];
  return {
    message: { text },
    from,
    reply: async (msg) => {
      replies.push(msg);
    },
    replies,
  };
}

describe('runPairingBot (Phase 4)', () => {
  it('일치 code + user_id 있으면 resolve + bot.stop', async () => {
    const mock = makeMockBot();
    const pending = runPairingBot('123:fake', 'TGW-ABC123', {
      botFactory: () => mock,
      logger: { log: () => {} },
    });
    // bot.init 가 microtask 단위라 setImmediate / setTimeout 으로 yield.
    await new Promise((r) => setImmediate(r));
    const ctx = makeCtx('/pair TGW-ABC123', { from: { id: 42, username: 'alice' } });
    await mock._fire(ctx);
    const result = await pending;
    assert.equal(result.userId, '42');
    assert.equal(result.username, 'alice');
    assert.equal(mock.stopped, true);
    assert.ok(ctx.replies.some((m) => m.includes('페어링 완료')));
  });

  it('/start <code> 도 페어링 명령으로 인식 — deep link 동치 (issue #137)', async () => {
    const mock = makeMockBot();
    const pending = runPairingBot('123:fake', 'TGW-ABC123', {
      botFactory: () => mock,
      logger: { log: () => {} },
    });
    await new Promise((r) => setImmediate(r));
    // `/start <code>` 가 Telegram deep link 클릭 시 자동 전송되는 명령. `/pair`
    // 와 동치로 페어링이 완료되어야 한다.
    const ctx = makeCtx('/start TGW-ABC123', { from: { id: 99, username: 'bob' } });
    await mock._fire(ctx);
    const result = await pending;
    assert.equal(result.userId, '99');
    assert.equal(result.username, 'bob');
    assert.equal(mock.stopped, true);
    assert.ok(ctx.replies.some((m) => m.includes('페어링 완료')));
  });

  it('/start <wrong-code> 도 mismatch 응답 (대기 지속)', async () => {
    const mock = makeMockBot();
    const pending = runPairingBot('123:fake', 'TGW-ABC123', {
      botFactory: () => mock,
      logger: { log: () => {} },
      timeoutMs: 200,
    });
    await new Promise((r) => setImmediate(r));
    const ctx = makeCtx('/start TGW-WRONG', { from: { id: 42 } });
    await mock._fire(ctx);
    assert.ok(ctx.replies.some((m) => m.includes('코드가 일치하지 않습니다')));
    assert.equal(mock.stopped, false);
    await assert.rejects(() => pending, /pairing timeout/);
  });

  it('일치하지 않는 code 는 안내 + 대기 지속', async () => {
    const mock = makeMockBot();
    const pending = runPairingBot('123:fake', 'TGW-ABC123', {
      botFactory: () => mock,
      logger: { log: () => {} },
      timeoutMs: 200,
    });
    await new Promise((r) => setImmediate(r));
    const ctx = makeCtx('/pair TGW-WRONG', { from: { id: 42 } });
    await mock._fire(ctx);
    assert.ok(ctx.replies.some((m) => m.includes('코드가 일치하지 않습니다')));
    assert.equal(mock.stopped, false);
    // pending 은 결국 timeout reject.
    await assert.rejects(() => pending, /pairing timeout/);
  });

  it('timeout 시 reject + bot.stop', async () => {
    const mock = makeMockBot();
    await assert.rejects(
      () =>
        runPairingBot('123:fake', 'TGW-XYZ789', {
          botFactory: () => mock,
          logger: { log: () => {} },
          timeoutMs: 50,
        }),
      /pairing timeout/,
    );
    assert.equal(mock.stopped, true);
  });

  it('botToken / expectedCode 없으면 throw', async () => {
    await assert.rejects(() => runPairingBot('', 'CODE'), /botToken/);
    await assert.rejects(() => runPairingBot('TOKEN', ''), /expectedCode/);
  });
});
