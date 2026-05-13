import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildDispatcher } from '../src/dispatcher.js';

function makeDeps() {
  let snapshotCalls = 0;
  let outputCalls = 0;
  let jsonCalls = 0;
  let doctorCalls = 0;
  let authListCalls = 0;
  return {
    deps: {
      getStatusSnapshot: async () => {
        snapshotCalls += 1;
        return { schemaVersion: '0.5.0' };
      },
      formatStatusOutput: () => {
        outputCalls += 1;
        return ['status text'];
      },
      formatStatusJson: () => {
        jsonCalls += 1;
        return '{"command":"status"}';
      },
      collectDoctorReport: async () => {
        doctorCalls += 1;
        return { configPath: '/cfg', claudeSnapshot: {} };
      },
      formatDoctorReportLines: () => ['doctor lines'],
      collectAuthListData: async () => {
        authListCalls += 1;
        return { providers: [], claudeImport: null };
      },
      formatAuthListLines: () => ['auth list'],
    },
    counts: () => ({ snapshotCalls, outputCalls, jsonCalls, doctorCalls, authListCalls }),
  };
}

function makeCtx() {
  const replies = [];
  return {
    reply: async (text, options) => {
      replies.push({ text, options });
    },
    replies,
  };
}

describe('buildDispatcher (Phase 3)', () => {
  it('5 명령 키가 정확히 노출됨 (status / usage / doctor / auth_list)', () => {
    const { deps } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    // status_json 은 별도 키가 아니라 status/usage 의 --json 분기로 들어감.
    assert.deepEqual(Object.keys(dispatcher).sort(), ['auth_list', 'doctor', 'status', 'usage']);
  });

  it('/status (no --json) → status-handler 호출 (formatStatusOutput 사용)', async () => {
    const { deps, counts } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx();
    await dispatcher.status(ctx, []);
    const c = counts();
    assert.equal(c.outputCalls, 1);
    assert.equal(c.jsonCalls, 0);
  });

  it('/status --json → status-json-handler 로 위임 (formatStatusJson 사용)', async () => {
    const { deps, counts } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx();
    await dispatcher.status(ctx, ['--json']);
    const c = counts();
    assert.equal(c.jsonCalls, 1);
    assert.equal(c.outputCalls, 0);
  });

  it('/usage (no --json) → status alias (formatStatusOutput 사용)', async () => {
    const { deps, counts } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx();
    await dispatcher.usage(ctx, []);
    const c = counts();
    assert.equal(c.outputCalls, 1);
  });

  it('/usage --json 도 동일 status-json 위임', async () => {
    const { deps, counts } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx();
    await dispatcher.usage(ctx, ['--json']);
    const c = counts();
    assert.equal(c.jsonCalls, 1);
  });

  it('/doctor → collectDoctorReport 호출', async () => {
    const { deps, counts } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx();
    await dispatcher.doctor(ctx, []);
    assert.equal(counts().doctorCalls, 1);
  });

  it('/auth_list → collectAuthListData 호출', async () => {
    const { deps, counts } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx();
    await dispatcher.auth_list(ctx, []);
    assert.equal(counts().authListCalls, 1);
  });
});
