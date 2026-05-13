import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createStatusHandler } from '../../src/handlers/status-handler.js';
import { createUsageHandler } from '../../src/handlers/usage-handler.js';

function makeCtx() {
  const replies = [];
  return {
    reply: async (text, options) => {
      replies.push({ text, options });
    },
    replies,
  };
}

describe('createStatusHandler (Phase 3)', () => {
  it('deps.getStatusSnapshot + deps.formatStatusOutput 호출 + <pre> wrap reply', async () => {
    let snapshotCalled = 0;
    let formatCalled = 0;
    const deps = {
      getStatusSnapshot: async () => {
        snapshotCalled += 1;
        return { schemaVersion: '0.5.0', providers: [] };
      },
      formatStatusOutput: (snapshot, ctx) => {
        formatCalled += 1;
        assert.equal(ctx.useColor, false, 'Telegram 응답은 항상 NO_COLOR');
        return ['line one', 'line two'];
      },
    };
    const handler = createStatusHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, []);
    assert.equal(snapshotCalled, 1);
    assert.equal(formatCalled, 1);
    assert.equal(ctx.replies.length, 1);
    assert.match(ctx.replies[0].text, /<pre>line one\nline two<\/pre>/);
    assert.deepEqual(ctx.replies[0].options, { parse_mode: 'HTML' });
  });

  it('출력이 길면 여러 chunk 로 split 후 각각 reply', async () => {
    const longText = Array.from({ length: 100 }, (_, i) => `line-${i}-${'x'.repeat(50)}`);
    const deps = {
      getStatusSnapshot: async () => ({}),
      formatStatusOutput: () => longText,
    };
    const handler = createStatusHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, []);
    assert.ok(ctx.replies.length > 1, 'expected multiple chunks');
    for (const r of ctx.replies) {
      assert.ok(r.text.length <= 4000, 'each chunk respects safe limit');
    }
  });
});

describe('createUsageHandler (Phase 3 — status alias)', () => {
  it('createStatusHandler 와 동일 동작', async () => {
    const deps = {
      getStatusSnapshot: async () => ({}),
      formatStatusOutput: () => ['usage line'],
    };
    const handler = createUsageHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, []);
    assert.equal(ctx.replies.length, 1);
    assert.match(ctx.replies[0].text, /<pre>usage line<\/pre>/);
  });
});
