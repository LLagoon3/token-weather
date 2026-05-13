import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runTelegramCommand } from '../src/index.js';

describe('@token-weather/telegram scaffold (Phase 1)', () => {
  it('runTelegramCommand 는 비동기 함수로 export 된다', () => {
    assert.equal(typeof runTelegramCommand, 'function');
  });

  it('argv + deps 두 인자 시그니처를 수용한다 (deps 주입 — PR #131 review)', async () => {
    // deps 주입 시그니처가 자리잡혔는지 호출 호환성으로 검증한다 (Phase 1
    // placeholder 단계에서는 어떤 deps 가 들어와도 NotImplemented).
    await assert.rejects(() => runTelegramCommand([], {}), /구현되지 않았습니다/);
  });

  it('Phase 1 단계에서는 호출 시 NotImplemented 오류를 던진다', async () => {
    await assert.rejects(() => runTelegramCommand([]), /구현되지 않았습니다/);
  });
});
