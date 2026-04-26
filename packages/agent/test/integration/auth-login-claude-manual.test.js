/**
 * Claude `--manual` flow 회귀 가드 (integration 수준).
 *
 * runManualPasteFlow를 spec stub + readPaste DI로 호출해, Claude처럼
 * supportsMockCallback=false인 provider가 manual paste 흐름에서 어떤 출력을
 * 내는지 영구 보장한다. 이 가드가 있으면 누군가 다시 "아직 제공하지 않습니다"
 * guard를 도입하거나 manual 분기를 빼면 즉시 회귀가 잡힌다.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runManualPasteFlow } from '../../src/cli/login-runner.js';

function captureConsoleLog() {
  const lines = [];
  const orig = console.log;
  console.log = (...args) => lines.push(args.map(String).join(' '));
  return {
    lines,
    restore: () => {
      console.log = orig;
    },
  };
}

const CLAUDE_LIKE_SPEC = {
  id: 'claude',
  displayName: 'Claude',
  storeKey: 'claude',
  accountKeyPrefix: 'anthropic-claude',
  callbackPath: '/callback',
  providerLabel: 'Claude',
  supportsMockCallback: false,
  // Claude 실 spec과 다르게 buildAuthorizationUrl / exchangeCode는 본 테스트에서
  // 호출되지 않으므로 정의하지 않는다 (--live-exchange 없는 경로 + state-mismatch).
};

describe('runManualPasteFlow (Claude-like, supportsMockCallback=false, no liveExchange)', () => {
  it('URL paste matching state → "token 교환을 생략" + saveMockAccount 호출 0회', async () => {
    let mockSaveCalls = 0;
    const spec = {
      ...CLAUDE_LIKE_SPEC,
      saveMockAccount: async () => {
        mockSaveCalls += 1;
      },
    };

    const cap = captureConsoleLog();
    try {
      await runManualPasteFlow(
        spec,
        {
          callbackUrl: 'http://127.0.0.1:1455/callback',
          codeVerifier: 'verifier-xyz',
          state: 'state-abc',
          liveExchange: false,
          label: null,
          keepLegacy: false,
        },
        {
          readPaste: async () => ({
            type: 'url',
            value: 'http://127.0.0.1:1455/callback?code=test-code&state=state-abc',
          }),
        },
      );
    } finally {
      cap.restore();
    }

    const out = cap.lines.join('\n');
    assert.match(out, /manual paste 모드입니다\./);
    assert.match(out, /code 수신 완료: test-code/);
    assert.match(out, /--live-exchange가 없으므로 token 교환을 생략합니다/);
    assert.equal(mockSaveCalls, 0, 'Claude는 supportsMockCallback=false라 mock 저장 0회여야 함');
  });

  it('URL paste matching state + liveExchange=true → spec.exchangeCode가 정확한 인자로 호출됨', async () => {
    // manual paste의 핵심 사용자 가치는 callback URL paste → runLiveExchangeStep
    // → spec.exchangeCode 호출 → 토큰 저장 경로다. exchangeCode가 throw하면
    // runLiveExchangeStep의 try/catch가 잡아 '토큰을 저장하지 않습니다'로 깔끔히
    // 종료하므로, 본 테스트는 exchangeCode 호출 인자만 검증하면 manual branch가
    // 핵심 경로로 연결됨을 보장 (저장까지 가는 것은 createAccount/auth-store
    // 흐름이라 별도 테스트 영역).
    const calls = [];
    const spec = {
      ...CLAUDE_LIKE_SPEC,
      endpointDescription: 'endpoint: claude.ai/oauth/token',
      exchangeCode: async (args) => {
        calls.push(args);
        throw new Error('test-stop-after-exchange');
      },
    };

    const cap = captureConsoleLog();
    try {
      await runManualPasteFlow(
        spec,
        {
          callbackUrl: 'http://127.0.0.1:1455/callback',
          codeVerifier: 'verifier-xyz',
          state: 'state-abc',
          liveExchange: true,
          label: null,
          keepLegacy: false,
        },
        {
          readPaste: async () => ({
            type: 'url',
            value: 'http://127.0.0.1:1455/callback?code=manual-code&state=state-abc',
          }),
        },
      );
    } finally {
      cap.restore();
    }

    assert.equal(calls.length, 1, 'exchangeCode가 정확히 1회 호출되어야 함');
    assert.deepEqual(calls[0], {
      code: 'manual-code',
      callbackUrl: 'http://127.0.0.1:1455/callback',
      codeVerifier: 'verifier-xyz',
      state: 'state-abc',
    });

    const out = cap.lines.join('\n');
    assert.match(out, /code 수신 완료: manual-code/);
    assert.match(out, /--live-exchange 모드/);
    // exchangeCode가 throw → runLiveExchangeStep catch → '토큰을 저장하지 않습니다'
    assert.match(out, /live token exchange 실패: test-stop-after-exchange/);
    assert.match(out, /토큰을 저장하지 않습니다\./);
  });

  it('URL paste mismatching state → "state-mismatch" + saveMockAccount 호출 0회', async () => {
    let mockSaveCalls = 0;
    const spec = {
      ...CLAUDE_LIKE_SPEC,
      saveMockAccount: async () => {
        mockSaveCalls += 1;
      },
    };

    const cap = captureConsoleLog();
    try {
      await runManualPasteFlow(
        spec,
        {
          callbackUrl: 'http://127.0.0.1:1455/callback',
          codeVerifier: 'verifier-xyz',
          state: 'expected-state',
          liveExchange: false,
          label: null,
          keepLegacy: false,
        },
        {
          readPaste: async () => ({
            type: 'url',
            value: 'http://127.0.0.1:1455/callback?code=test-code&state=DIFFERENT-state',
          }),
        },
      );
    } finally {
      cap.restore();
    }

    const out = cap.lines.join('\n');
    assert.match(out, /manual paste 모드입니다\./);
    assert.match(out, /입력 처리 실패: state-mismatch/);
    // state-mismatch면 token 교환 안내까지 도달하지 않아야 함.
    assert.equal(out.includes('token 교환을 생략'), false);
    assert.equal(mockSaveCalls, 0);
  });
});
