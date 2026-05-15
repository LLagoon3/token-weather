import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { compactProgressBar } from '../src/telegram-progress-bar.js';

describe('compactProgressBar', () => {
  it('0% → 전부 light shade', () => {
    assert.equal(compactProgressBar(0, 10), '░░░░░░░░░░');
  });

  it('100% → 전부 full block', () => {
    assert.equal(compactProgressBar(100, 10), '██████████');
  });

  it('50% → 절반 full + 절반 shade', () => {
    assert.equal(compactProgressBar(50, 10), '█████░░░░░');
  });

  it('10% width=10 → 1 full block (정확히 8 eighths) + 9 shade', () => {
    assert.equal(compactProgressBar(10, 10), '█░░░░░░░░░');
  });

  it('12.5% width=10 → 1 full + ▎ remainder (10 eighths = 1 full + 2/8)', () => {
    assert.equal(compactProgressBar(12.5, 10), '█▎░░░░░░░░');
  });

  it('38% → 3 full + ▌(remainder 4) + 6 shade', () => {
    // 38 * 10 * 8 / 100 = 30.4 → round → 30 → fullBlocks=3, rem=6 → ▊
    assert.equal(compactProgressBar(38, 10), '███▊░░░░░░');
  });

  it('71% → 7 full + ▏(remainder 1) + 2 shade', () => {
    // 71 * 10 * 8 / 100 = 56.8 → round → 57 → fullBlocks=7, rem=1 → ▏
    assert.equal(compactProgressBar(71, 10), '███████▏░░');
  });

  it('null / undefined / NaN → 전부 shade (0% 와 시각 구분은 pct 텍스트 책임)', () => {
    assert.equal(compactProgressBar(null, 10), '░░░░░░░░░░');
    assert.equal(compactProgressBar(undefined, 10), '░░░░░░░░░░');
    assert.equal(compactProgressBar(NaN, 10), '░░░░░░░░░░');
  });

  it('out-of-range → [0, 100] clamp', () => {
    assert.equal(compactProgressBar(-10, 10), '░░░░░░░░░░');
    assert.equal(compactProgressBar(150, 10), '██████████');
  });

  it('width=5 → 5 visible 문자', () => {
    assert.equal([...compactProgressBar(50, 5)].length, 5);
    assert.equal(compactProgressBar(0, 5), '░░░░░');
    assert.equal(compactProgressBar(100, 5), '█████');
  });

  it('width=20 → 20 visible 문자', () => {
    assert.equal([...compactProgressBar(50, 20)].length, 20);
    assert.equal(compactProgressBar(50, 20), '██████████░░░░░░░░░░');
  });

  it('default width=10', () => {
    assert.equal([...compactProgressBar(50)].length, 10);
  });

  it('어떤 입력이어도 반환 길이는 width visible 문자 (코드포인트 단위)', () => {
    const cases = [
      [0, 10], [12.5, 10], [37.5, 10], [50, 10], [62.5, 10], [87.5, 10], [100, 10],
      [null, 10], [NaN, 10], [-5, 10], [150, 10],
      [0, 4], [50, 4], [100, 4],
    ];
    for (const [pct, w] of cases) {
      const bar = compactProgressBar(pct, w);
      assert.equal([...bar].length, w, `pct=${pct} width=${w} → ${bar}`);
    }
  });

  it('ANSI escape 문자 미포함 (텔레그램 <pre> HTML 호환)', () => {
    for (const pct of [0, 25, 50, 75, 100, null]) {
      const bar = compactProgressBar(pct, 10);
      assert.ok(!bar.includes('\x1b'), `ANSI 미포함 기대 (pct=${pct}): ${bar}`);
    }
  });
});
