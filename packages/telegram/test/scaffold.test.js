import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runTelegramCommand } from '../src/index.js';

describe('@token-weather/telegram scaffold (Phase 1)', () => {
  it('runTelegramCommand 는 비동기 함수로 export 된다', () => {
    assert.equal(typeof runTelegramCommand, 'function');
  });

  it('Phase 1 단계에서는 호출 시 NotImplemented 오류를 던진다', async () => {
    await assert.rejects(() => runTelegramCommand([]), /구현되지 않았습니다/);
  });
});
