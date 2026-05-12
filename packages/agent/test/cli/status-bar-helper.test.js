import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldUseColor,
  levelForPercent,
  colorize,
  formatProgressBar,
} from '../../src/cli/status-bar-helper.js';

describe('shouldUseColor', () => {
  it('true when stream.isTTY and no NO_COLOR / TERM=dumb', () => {
    assert.equal(shouldUseColor({ stream: { isTTY: true }, env: {} }), true);
  });

  it('false when stream is missing', () => {
    assert.equal(shouldUseColor({ stream: undefined, env: {} }), false);
    assert.equal(shouldUseColor({}), false);
  });

  it('false when stream.isTTY is false (pipe / redirect)', () => {
    assert.equal(shouldUseColor({ stream: { isTTY: false }, env: {} }), false);
  });

  it('false when NO_COLOR env is set (no-color.org)', () => {
    assert.equal(shouldUseColor({ stream: { isTTY: true }, env: { NO_COLOR: '1' } }), false);
    // any non-empty value disables
    assert.equal(shouldUseColor({ stream: { isTTY: true }, env: { NO_COLOR: 'any' } }), false);
  });

  it('true when NO_COLOR is empty string (not set)', () => {
    assert.equal(shouldUseColor({ stream: { isTTY: true }, env: { NO_COLOR: '' } }), true);
  });

  it('false when TERM=dumb', () => {
    assert.equal(shouldUseColor({ stream: { isTTY: true }, env: { TERM: 'dumb' } }), false);
  });

  it('true with normal TERM value', () => {
    assert.equal(
      shouldUseColor({ stream: { isTTY: true }, env: { TERM: 'xterm-256color' } }),
      true,
    );
  });
});

describe('levelForPercent', () => {
  it('< 50 → green', () => {
    assert.equal(levelForPercent(0), 'green');
    assert.equal(levelForPercent(25), 'green');
    assert.equal(levelForPercent(49), 'green');
  });

  it('50 ≤ p < 80 → yellow', () => {
    assert.equal(levelForPercent(50), 'yellow');
    assert.equal(levelForPercent(65), 'yellow');
    assert.equal(levelForPercent(79), 'yellow');
  });

  it('≥ 80 → red', () => {
    assert.equal(levelForPercent(80), 'red');
    assert.equal(levelForPercent(95), 'red');
    assert.equal(levelForPercent(100), 'red');
  });

  it('null / NaN / undefined → null (unknown)', () => {
    assert.equal(levelForPercent(null), null);
    assert.equal(levelForPercent(undefined), null);
    assert.equal(levelForPercent(NaN), null);
  });
});

describe('colorize', () => {
  it('returns plain text when useColor=false', () => {
    assert.equal(colorize('hello', 'red', false), 'hello');
    assert.equal(colorize('hello', 'green', false), 'hello');
  });

  it('returns plain text when level is null', () => {
    assert.equal(colorize('hello', null, true), 'hello');
  });

  it('wraps with ANSI escape when useColor=true', () => {
    assert.equal(colorize('x', 'green', true), '\x1b[32mx\x1b[0m');
    assert.equal(colorize('x', 'yellow', true), '\x1b[33mx\x1b[0m');
    assert.equal(colorize('x', 'red', true), '\x1b[31mx\x1b[0m');
  });
});

describe('formatProgressBar', () => {
  it('renders 0% as all empty blocks', () => {
    assert.equal(formatProgressBar(0, { width: 10 }), '[░░░░░░░░░░]');
  });

  it('renders 100% as all filled blocks', () => {
    assert.equal(formatProgressBar(100, { width: 10 }), '[██████████]');
  });

  it('renders 50% as half-filled (rounded)', () => {
    assert.equal(formatProgressBar(50, { width: 10 }), '[█████░░░░░]');
  });

  it('null / NaN renders as [n/a + padding]', () => {
    const bar = formatProgressBar(null, { width: 10 });
    assert.equal(bar, '[n/a       ]');
    assert.equal(bar.length, 12); // [ + 10 + ]
    assert.equal(formatProgressBar(NaN, { width: 10 }), '[n/a       ]');
  });

  it('clamps values outside 0-100 range', () => {
    assert.equal(formatProgressBar(-10, { width: 10 }), '[░░░░░░░░░░]');
    assert.equal(formatProgressBar(150, { width: 10 }), '[██████████]');
  });

  it('default width is 20', () => {
    const bar = formatProgressBar(50);
    assert.equal(bar.length, 22); // [ + 20 + ]
  });

  it('useColor=false produces no ANSI escape', () => {
    const bar = formatProgressBar(95, { width: 10, useColor: false });
    assert.ok(!bar.includes('\x1b['));
  });

  it('useColor=true wraps the filled portion in ANSI codes', () => {
    const bar = formatProgressBar(95, { width: 10, useColor: true });
    assert.ok(bar.includes('\x1b[31m')); // red for ≥80
    assert.ok(bar.includes('\x1b[0m'));
  });

  it('useColor=true with null percent → no ANSI (level=null)', () => {
    const bar = formatProgressBar(null, { width: 10, useColor: true });
    assert.ok(!bar.includes('\x1b['));
  });
});
