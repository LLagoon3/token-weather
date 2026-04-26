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
