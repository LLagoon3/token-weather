import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createHelpHandler } from '../../src/handlers/help-handler.js';
import { BOT_COMMANDS, formatHelpText } from '../../src/bot-commands.js';

function makeCtx() {
  const replies = [];
  return {
    reply: async (text, options) => {
      replies.push({ text, options });
    },
    replies,
  };
}

describe('createHelpHandler (issue #148)', () => {
  it('reply 1 회 + formatHelpText() 결과와 정확히 일치', async () => {
    const handler = createHelpHandler();
    const ctx = makeCtx();
    await handler(ctx, []);
    assert.equal(ctx.replies.length, 1);
    assert.equal(ctx.replies[0].text, formatHelpText());
  });

  it('reply 옵션 미지정 — plain text (parse_mode 없음)', async () => {
    const handler = createHelpHandler();
    const ctx = makeCtx();
    await handler(ctx, []);
    assert.equal(ctx.replies[0].options, undefined);
  });

  it('args 가 무엇이든 동일 출력 (인자 무시)', async () => {
    const handler = createHelpHandler();
    const ctx1 = makeCtx();
    const ctx2 = makeCtx();
    await handler(ctx1, []);
    await handler(ctx2, ['--json', 'foo']);
    assert.equal(ctx1.replies[0].text, ctx2.replies[0].text);
  });

  it('reply 본문에 모든 BOT_COMMANDS 항목이 등장', async () => {
    const handler = createHelpHandler();
    const ctx = makeCtx();
    await handler(ctx, []);
    const text = ctx.replies[0].text;
    for (const { command } of BOT_COMMANDS) {
      assert.ok(text.includes(`/${command}`), `/${command} 누락`);
    }
  });
});
