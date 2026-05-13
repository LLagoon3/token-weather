import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createAuthListHandler } from '../../src/handlers/auth-list-handler.js';

function makeCtx() {
  const replies = [];
  return {
    reply: async (text, options) => {
      replies.push({ text, options });
    },
    replies,
  };
}

describe('createAuthListHandler (Phase 3)', () => {
  it('deps.collectAuthListData + deps.formatAuthListLines 호출 + <pre> reply', async () => {
    let dataCalled = 0;
    let formatCalled = 0;
    const deps = {
      collectAuthListData: async () => {
        dataCalled += 1;
        return { providers: [], claudeImport: null };
      },
      formatAuthListLines: (data) => {
        formatCalled += 1;
        assert.equal(data.providers.length, 0);
        return ['저장된 인증 계정이 없습니다.'];
      },
    };
    const handler = createAuthListHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, []);
    assert.equal(dataCalled, 1);
    assert.equal(formatCalled, 1);
    assert.equal(ctx.replies.length, 1);
    assert.match(ctx.replies[0].text, /<pre>.*저장된 인증 계정이 없습니다.*<\/pre>/);
    assert.deepEqual(ctx.replies[0].options, { parse_mode: 'HTML' });
  });

  it('args 는 무시 — provider 필터 / --help 전달 안 함', async () => {
    let capturedArgs = null;
    const deps = {
      collectAuthListData: async (...args) => {
        capturedArgs = args;
        return { providers: [], claudeImport: null };
      },
      formatAuthListLines: () => ['ok'],
    };
    const handler = createAuthListHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, ['claude', '--help']);
    assert.deepEqual(capturedArgs, []);
  });
});
