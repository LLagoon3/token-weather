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

function minimalSnapshot() {
  return {
    schemaVersion: '0.5.0',
    configPath: '/home/u/.config/token-weather/config.json',
    providers: { codex: { enabled: true }, claude: { enabled: true } },
    sync: { enabled: false },
    accountFilter: null,
    providerFilter: null,
  };
}

describe('createStatusHandler (Phase 3 + issue #144)', () => {
  it('deps.getStatusSnapshot 호출 + telegram-compact 출력을 <pre> wrap reply', async () => {
    let snapshotCalled = 0;
    const deps = {
      getStatusSnapshot: async () => {
        snapshotCalled += 1;
        return minimalSnapshot();
      },
    };
    const handler = createStatusHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, []);
    assert.equal(snapshotCalled, 1);
    assert.equal(ctx.replies.length, 1);
    assert.match(ctx.replies[0].text, /^<pre>━━ Status ━━\n/);
    assert.match(ctx.replies[0].text, /<\/pre>$/);
    assert.deepEqual(ctx.replies[0].options, { parse_mode: 'HTML' });
  });

  it('출력은 박스 글리프 없이 telegram 친화 포맷 (회귀 가드)', async () => {
    const deps = { getStatusSnapshot: async () => minimalSnapshot() };
    const handler = createStatusHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, []);
    const text = ctx.replies[0].text;
    for (const glyph of ['╭', '│', '╰', '┌', '└', '█', '░']) {
      assert.ok(!text.includes(glyph), `glyph 미포함 기대: ${glyph}`);
    }
  });

  it('긴 출력은 formatPreChunksForTelegram 으로 chunk 분할', async () => {
    const manyAccounts = Array.from({ length: 200 }, (_, i) => ({
      account: { email: `user${i}@example.com`, plan: 'Pro' },
      status: { ok: true, httpStatus: 200 },
      usageWindows: [],
    }));
    const deps = {
      getStatusSnapshot: async () => ({
        ...minimalSnapshot(),
        codex: { enabled: true, usageSnapshots: manyAccounts, filteredOut: false },
      }),
    };
    const handler = createStatusHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, []);
    assert.ok(ctx.replies.length > 1, 'expected multiple chunks');
    for (const r of ctx.replies) {
      assert.ok(r.text.length <= 4096, '각 chunk 4096 자 한도 준수');
    }
  });
});

describe('createUsageHandler (Phase 3 — status alias)', () => {
  it('createStatusHandler 와 동일 동작', async () => {
    const deps = { getStatusSnapshot: async () => minimalSnapshot() };
    const handler = createUsageHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, []);
    assert.equal(ctx.replies.length, 1);
    assert.match(ctx.replies[0].text, /<pre>━━ Status ━━/);
  });
});
