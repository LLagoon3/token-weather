import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createStatusJsonHandler } from '../../src/handlers/status-json-handler.js';

function makeCtx() {
  const replies = [];
  return {
    reply: async (text, options) => {
      replies.push({ text, options });
    },
    replies,
  };
}

describe('createStatusJsonHandler (Phase 3)', () => {
  it('deps.formatStatusJson 호출 + JSON 응답을 <pre> 로 wrap', async () => {
    let captured = null;
    const deps = {
      getStatusSnapshot: async () => ({ schemaVersion: '0.5.0' }),
      formatStatusJson: (snapshot, meta) => {
        captured = { snapshot, meta };
        return '{"schemaVersion":"0.5.0","command":"status"}';
      },
    };
    const handler = createStatusJsonHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, ['--json']);
    assert.equal(captured.meta.command, 'status');
    assert.equal(ctx.replies.length, 1);
    assert.match(ctx.replies[0].text, /<pre>\{.*schemaVersion.*\}<\/pre>/);
    assert.deepEqual(ctx.replies[0].options, { parse_mode: 'HTML' });
  });

  it('JSON 의 HTML 특수문자 (< > &) 가 escape 됨', async () => {
    const deps = {
      getStatusSnapshot: async () => ({}),
      formatStatusJson: () => '{"label":"<a>&b</a>"}',
    };
    const handler = createStatusJsonHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, []);
    assert.match(ctx.replies[0].text, /&lt;a&gt;&amp;b&lt;\/a&gt;/);
  });
});
