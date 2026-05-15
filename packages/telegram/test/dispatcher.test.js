import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildDispatcher } from '../src/dispatcher.js';
import { BOT_COMMANDS } from '../src/bot-commands.js';

function minimalStatusSnapshot() {
  return {
    schemaVersion: '0.5.0',
    providers: { codex: { enabled: true }, claude: { enabled: true } },
    sync: { enabled: false },
    accountFilter: null,
    providerFilter: null,
  };
}

function makeDeps() {
  let snapshotCalls = 0;
  let jsonCalls = 0;
  let doctorCalls = 0;
  let authListCalls = 0;
  return {
    deps: {
      getStatusSnapshot: async () => {
        snapshotCalls += 1;
        return minimalStatusSnapshot();
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
    counts: () => ({ snapshotCalls, jsonCalls, doctorCalls, authListCalls }),
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

describe('buildDispatcher (Phase 3 + issue #144)', () => {
  it('명령 키가 정확히 노출됨 (status / usage / doctor / auth_list / help — issue #148)', () => {
    const { deps } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    assert.deepEqual(Object.keys(dispatcher).sort(), [
      'auth_list',
      'doctor',
      'help',
      'status',
      'usage',
    ]);
  });

  it('dispatcher 키 집합이 BOT_COMMANDS.command 집합과 정확히 일치 (drift 가드, PR #149 self-review)', () => {
    const { deps } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const dispatcherKeys = Object.keys(dispatcher).sort();
    const botCommandNames = BOT_COMMANDS.map((c) => c.command).sort();
    assert.deepEqual(
      dispatcherKeys,
      botCommandNames,
      `drift 발생: dispatcher 키와 BOT_COMMANDS.command 집합이 어긋남. ` +
        `새 명령 추가 시 핸들러 / buildDispatcher 키 / BOT_COMMANDS entry 세 곳을 모두 갱신하세요.`,
    );
  });

  it('/help → BOT_COMMANDS 기반 plain text reply (issue #148)', async () => {
    const { deps } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx();
    await dispatcher.help(ctx, []);
    assert.equal(ctx.replies.length, 1);
    assert.match(ctx.replies[0].text, /^Token Weather 봇 명령:/);
    assert.match(ctx.replies[0].text, /\/help/);
    assert.equal(ctx.replies[0].options, undefined, 'plain text — parse_mode 없음');
  });

  it('/status (no --json) → status-handler 호출 (telegram-compact 출력 + reply)', async () => {
    const { deps, counts } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx();
    await dispatcher.status(ctx, []);
    const c = counts();
    assert.equal(c.snapshotCalls, 1);
    assert.equal(c.jsonCalls, 0);
    assert.equal(ctx.replies.length, 1);
    assert.match(ctx.replies[0].text, /<pre>━━ Status ━━/);
  });

  it('/status --json → status-json-handler 로 위임 (formatStatusJson 사용)', async () => {
    const { deps, counts } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx();
    await dispatcher.status(ctx, ['--json']);
    const c = counts();
    assert.equal(c.jsonCalls, 1);
    assert.equal(ctx.replies.length, 1);
  });

  it('/status --json 의 meta.command 는 "status" (PR #134 review)', async () => {
    let captured = null;
    const deps = {
      getStatusSnapshot: async () => ({}),
      formatStatusJson: (_, meta) => {
        captured = meta;
        return '{}';
      },
      collectDoctorReport: async () => ({}),
      formatDoctorReportLines: () => [],
      collectAuthListData: async () => ({ providers: [], claudeImport: null }),
      formatAuthListLines: () => [],
    };
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx();
    await dispatcher.status(ctx, ['--json']);
    assert.equal(captured.command, 'status');
  });

  it('/usage --json 의 meta.command 는 "usage" — CLI 정합 (PR #134 review)', async () => {
    let captured = null;
    const deps = {
      getStatusSnapshot: async () => ({}),
      formatStatusJson: (_, meta) => {
        captured = meta;
        return '{}';
      },
      collectDoctorReport: async () => ({}),
      formatDoctorReportLines: () => [],
      collectAuthListData: async () => ({ providers: [], claudeImport: null }),
      formatAuthListLines: () => [],
    };
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx();
    await dispatcher.usage(ctx, ['--json']);
    assert.equal(captured.command, 'usage');
  });

  it('/usage (no --json) → status alias (telegram-compact 출력 + reply)', async () => {
    const { deps, counts } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx();
    await dispatcher.usage(ctx, []);
    const c = counts();
    assert.equal(c.snapshotCalls, 1);
    assert.equal(ctx.replies.length, 1);
    assert.match(ctx.replies[0].text, /<pre>━━ Status ━━/);
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
