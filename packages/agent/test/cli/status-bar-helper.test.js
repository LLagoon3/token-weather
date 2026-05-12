import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldUseColor,
  levelForPercent,
  colorize,
  formatProgressBar,
  formatResetTime,
  formatWindowLabel,
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
  it('renders 0% as all light-shade blocks (default width 50)', () => {
    const bar = formatProgressBar(0);
    assert.equal(bar.length, 50);
    assert.equal(bar, '░'.repeat(50));
  });

  it('renders 100% as all filled blocks (default width 50)', () => {
    assert.equal(formatProgressBar(100), '█'.repeat(50));
  });

  it('renders 5% with eighth-block precision at width 50 (5/100*50 = 2.5 → 2 full + half)', () => {
    // 2.5 units * 8 = 20 eighths → 2 full blocks + 4/8 = ▌
    const bar = formatProgressBar(5, { width: 50 });
    assert.equal(bar.startsWith('██▌'), true);
    assert.equal(bar.length, 50);
    // 빈 자리는 light shade '░' 로 시각화 (issue #116 review)
    assert.equal(bar.slice(3), '░'.repeat(47));
  });

  it('renders 39% at width 50 (19.5 units → 19 full + half + light shade)', () => {
    const bar = formatProgressBar(39, { width: 50 });
    assert.equal(bar.startsWith('█'.repeat(19) + '▌'), true);
    assert.equal(bar.length, 50);
    assert.ok(bar.endsWith('░'));
  });

  it('renders 4% at width 50 (2 units → 2 full + light shade fill)', () => {
    const bar = formatProgressBar(4, { width: 50 });
    assert.equal(bar.startsWith('██░'), true);
    assert.equal(bar.length, 50);
  });

  it('null / NaN renders as all light-shade (unknown vs 0% disambiguated by `--` pct text)', () => {
    assert.equal(formatProgressBar(null, { width: 20 }), '░'.repeat(20));
    assert.equal(formatProgressBar(NaN, { width: 20 }), '░'.repeat(20));
  });

  it('clamps values outside 0-100 range', () => {
    assert.equal(formatProgressBar(-10, { width: 10 }), '░'.repeat(10));
    assert.equal(formatProgressBar(150, { width: 10 }), '█'.repeat(10));
  });

  it('default width is 50', () => {
    const bar = formatProgressBar(50);
    assert.equal(bar.length, 50);
  });

  it('useColor=false produces no ANSI escape', () => {
    const bar = formatProgressBar(95, { width: 20, useColor: false });
    assert.ok(!bar.includes('\x1b['));
  });

  it('useColor=true wraps the filled portion in ANSI codes', () => {
    const bar = formatProgressBar(95, { width: 20, useColor: true });
    assert.ok(bar.includes('\x1b[31m')); // red for ≥80
    assert.ok(bar.includes('\x1b[0m'));
  });

  it('useColor=true with null percent → no ANSI (level=null)', () => {
    const bar = formatProgressBar(null, { width: 20, useColor: true });
    assert.ok(!bar.includes('\x1b['));
  });
});

describe('formatResetTime', () => {
  // Avoid TZ-dependent assertions in tests by using a fixed local "now" and
  // working in the local TZ. We check structural shape, not exact strings.

  it('returns "unknown" for null/undefined/empty', () => {
    assert.equal(formatResetTime(null), 'unknown');
    assert.equal(formatResetTime(undefined), 'unknown');
    assert.equal(formatResetTime(''), 'unknown');
  });

  it('returns the original string for invalid dates', () => {
    assert.equal(formatResetTime('not-a-date'), 'not-a-date');
  });

  it('same-day → time only with TZ in parentheses', () => {
    const now = new Date('2026-05-12T10:00:00');
    // 같은 날의 14:00 — same toDateString
    const reset = new Date(now);
    reset.setHours(14, 0, 0, 0);
    const result = formatResetTime(reset.toISOString(), now);
    // 같은 날이므로 month/day prefix 없음
    assert.ok(!/^[A-Z][a-z]{2} \d/.test(result));
    // pm + TZ 괄호 포함
    assert.match(result, /pm \(/);
    assert.match(result, /\)$/);
  });

  it('different day → includes month + day prefix', () => {
    const now = new Date('2026-05-12T10:00:00');
    const reset = new Date('2026-05-15T03:00:00');
    const result = formatResetTime(reset.toISOString(), now);
    assert.match(result, /^May 15, 3am \(/);
  });

  it('omits minutes when 0, includes when non-zero', () => {
    const now = new Date('2026-05-12T10:00:00');
    const r1 = new Date(now);
    r1.setHours(14, 0, 0, 0);
    const r2 = new Date(now);
    r2.setHours(14, 30, 0, 0);
    assert.match(formatResetTime(r1.toISOString(), now), /^2pm /);
    assert.match(formatResetTime(r2.toISOString(), now), /^2:30pm /);
  });

  it('midnight renders as 12am, noon as 12pm', () => {
    const now = new Date('2026-05-12T10:00:00');
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const noon = new Date(now);
    noon.setHours(12, 0, 0, 0);
    assert.match(formatResetTime(midnight.toISOString(), now), /^12am /);
    assert.match(formatResetTime(noon.toISOString(), now), /^12pm /);
  });
});

describe('formatWindowLabel', () => {
  it('WINDOW_LABELS mapping wins over window.label for known kinds', () => {
    // adapter 의 generic label (예: `${kind} window`) 보다 formatter UX 결정이 우선.
    assert.equal(formatWindowLabel({ label: 'primary window', kind: 'primary' }), 'Primary window');
  });

  it('falls back to window.label for unknown kinds', () => {
    assert.equal(
      formatWindowLabel({ label: 'Custom Adapter Label', kind: 'custom_window' }),
      'Custom Adapter Label',
    );
  });

  it('maps known kinds to friendly labels', () => {
    assert.equal(formatWindowLabel({ kind: 'primary' }), 'Primary window');
    assert.equal(formatWindowLabel({ kind: 'secondary' }), 'Secondary window');
    assert.equal(formatWindowLabel({ kind: 'five_hour' }), 'Current session (5h)');
    assert.equal(formatWindowLabel({ kind: 'seven_day' }), 'Current week (all models)');
    assert.equal(formatWindowLabel({ kind: 'seven_day_sonnet' }), 'Current week (Sonnet only)');
    assert.equal(formatWindowLabel({ kind: 'seven_day_opus' }), 'Current week (Opus only)');
  });

  it('falls back to kind for unknown kinds', () => {
    assert.equal(formatWindowLabel({ kind: 'custom_window' }), 'custom_window');
  });

  it('returns generic "Window" when both label and kind are missing', () => {
    assert.equal(formatWindowLabel({}), 'Window');
    assert.equal(formatWindowLabel(null), 'Window');
    assert.equal(formatWindowLabel(undefined), 'Window');
  });
});
