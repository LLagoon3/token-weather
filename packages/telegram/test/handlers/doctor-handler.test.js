import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createDoctorHandler } from '../../src/handlers/doctor-handler.js';

function makeCtx() {
  const replies = [];
  return {
    reply: async (text, options) => {
      replies.push({ text, options });
    },
    replies,
  };
}

describe('createDoctorHandler (Phase 3)', () => {
  it('deps.collectDoctorReport + deps.formatDoctorReportLines 호출 + <pre> reply', async () => {
    let reportCalled = 0;
    let formatCalled = 0;
    const deps = {
      collectDoctorReport: async () => {
        reportCalled += 1;
        return { configPath: '/cfg', claudeSnapshot: {} };
      },
      formatDoctorReportLines: (report) => {
        formatCalled += 1;
        assert.equal(report.configPath, '/cfg');
        return ['doctor line 1', 'doctor line 2'];
      },
    };
    const handler = createDoctorHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, []);
    assert.equal(reportCalled, 1);
    assert.equal(formatCalled, 1);
    assert.equal(ctx.replies.length, 1);
    assert.match(ctx.replies[0].text, /<pre>doctor line 1\ndoctor line 2<\/pre>/);
    assert.deepEqual(ctx.replies[0].options, { parse_mode: 'HTML' });
  });

  it('args 는 무시 — MVP 는 기본 호출만 (보안 표면 최소)', async () => {
    let capturedArgs = null;
    const deps = {
      collectDoctorReport: async (...args) => {
        capturedArgs = args;
        return { configPath: '/cfg', claudeSnapshot: {} };
      },
      formatDoctorReportLines: () => ['ok'],
    };
    const handler = createDoctorHandler(deps);
    const ctx = makeCtx();
    await handler(ctx, ['codex', '--refresh-live']);
    assert.deepEqual(capturedArgs, [], 'collectDoctorReport 가 args 없이 호출되어야 함');
  });
});
