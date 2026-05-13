/**
 * router e2e — buildDispatcher 결과를 handleTextMessage 에 주입해, message 텍스트
 * 한 줄 → 정확한 deps 함수 호출 + Telegram reply 까지 결합 시나리오를 확인.
 *
 * 단위 테스트 (dispatcher.test.js + bot-server.test.js handleTextMessage 케이스)
 * 가 각자 책임을 커버하고 본 파일은 두 모듈의 결합 sanity 만 잡는다 — Phase 3
 * 의 통합 contract 가 깨지지 않음을 보장.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildDispatcher } from '../src/dispatcher.js';
import { handleTextMessage } from '../src/bot-server.js';

function makeDeps() {
  const calls = {
    snapshot: 0,
    output: 0,
    json: 0,
    doctorReport: 0,
    doctorLines: 0,
    authListData: 0,
    authListLines: 0,
  };
  return {
    deps: {
      getStatusSnapshot: async () => {
        calls.snapshot += 1;
        return { schemaVersion: '0.5.0' };
      },
      formatStatusOutput: () => {
        calls.output += 1;
        return ['status text'];
      },
      formatStatusJson: () => {
        calls.json += 1;
        return '{"command":"status","schemaVersion":"0.5.0"}';
      },
      collectDoctorReport: async () => {
        calls.doctorReport += 1;
        return { configPath: '/cfg', claudeSnapshot: {} };
      },
      formatDoctorReportLines: () => {
        calls.doctorLines += 1;
        return ['doctor report'];
      },
      collectAuthListData: async () => {
        calls.authListData += 1;
        return { providers: [], claudeImport: null };
      },
      formatAuthListLines: () => {
        calls.authListLines += 1;
        return ['auth list'];
      },
    },
    calls,
  };
}

function makeCtx(text, { username = 'TokenWeatherBot' } = {}) {
  const replies = [];
  return {
    message: { text },
    me: { username },
    reply: async (text, options) => {
      replies.push({ text, options });
    },
    replies,
  };
}

describe('router e2e — message text → dispatcher → deps + reply (Phase 3)', () => {
  it('/status → status handler → formatStatusOutput + <pre> reply', async () => {
    const { deps, calls } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx('/status');
    await handleTextMessage(ctx, { dispatcher });
    assert.equal(calls.snapshot, 1);
    assert.equal(calls.output, 1);
    assert.equal(calls.json, 0);
    assert.equal(ctx.replies.length, 1);
    assert.match(ctx.replies[0].text, /<pre>status text<\/pre>/);
    assert.deepEqual(ctx.replies[0].options, { parse_mode: 'HTML' });
  });

  it('/status --json → status-json handler → formatStatusJson + <pre> reply', async () => {
    const { deps, calls } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx('/status --json');
    await handleTextMessage(ctx, { dispatcher });
    assert.equal(calls.json, 1);
    assert.equal(calls.output, 0);
    assert.match(ctx.replies[0].text, /<pre>\{.*schemaVersion.*\}<\/pre>/);
  });

  it('/usage → status alias (formatStatusOutput 호출)', async () => {
    const { deps, calls } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx('/usage');
    await handleTextMessage(ctx, { dispatcher });
    assert.equal(calls.output, 1);
  });

  it('/doctor → collectDoctorReport + formatDoctorReportLines + reply', async () => {
    const { deps, calls } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx('/doctor');
    await handleTextMessage(ctx, { dispatcher });
    assert.equal(calls.doctorReport, 1);
    assert.equal(calls.doctorLines, 1);
    assert.match(ctx.replies[0].text, /<pre>doctor report<\/pre>/);
  });

  it('/auth_list → collectAuthListData + formatAuthListLines + reply', async () => {
    const { deps, calls } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx('/auth_list');
    await handleTextMessage(ctx, { dispatcher });
    assert.equal(calls.authListData, 1);
    assert.equal(calls.authListLines, 1);
    assert.match(ctx.replies[0].text, /<pre>auth list<\/pre>/);
  });

  it('/unknown → "알 수 없는 명령" reply + dispatcher 호출 없음', async () => {
    const { deps, calls } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx('/unknown');
    await handleTextMessage(ctx, { dispatcher });
    assert.equal(calls.snapshot, 0);
    assert.equal(calls.doctorReport, 0);
    assert.equal(ctx.replies.length, 1);
    assert.match(ctx.replies[0].text, /알 수 없는 명령/);
  });

  it('/status@OtherBot → silent (다른 봇 mention, reply 0)', async () => {
    const { deps } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx('/status@OtherBot');
    await handleTextMessage(ctx, { dispatcher });
    assert.equal(ctx.replies.length, 0);
  });

  it('/status@TokenWeatherBot --json → 본인 mention + JSON → status-json 호출', async () => {
    const { deps, calls } = makeDeps();
    const dispatcher = buildDispatcher(deps);
    const ctx = makeCtx('/status@TokenWeatherBot --json');
    await handleTextMessage(ctx, { dispatcher });
    assert.equal(calls.json, 1);
  });
});
