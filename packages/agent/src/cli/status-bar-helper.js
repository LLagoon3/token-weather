/**
 * cli:status 평문 출력의 ASCII 막대 그래프 + ANSI 컬러 + 친화적 reset 시간
 * helper. claude-code `/usage` 스타일을 모사한 multi-line block.
 *
 * 모든 함수는 pure — stream / env / now 는 호출자가 주입한다 (테스트 친화).
 * 외부 runtime dep 0 정책에 따라 chalk 등 미사용, raw ANSI escape 직접 출력.
 *
 * 컬러 임계값 (codex /usage + claude-code rate-limit UI 컨벤션):
 *   < 50%   green
 *   50-79%  yellow
 *   ≥ 80%   red
 */

const ANSI = Object.freeze({
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
});

const DEFAULT_BAR_WIDTH = 50;

// eighth-block fractional 문자 — index 1..7. index 0 / 8 은 별도 처리.
const FRACTIONAL_CHARS = Object.freeze(['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']);

// 알려진 window kind → 사람이 읽기 좋은 라벨. 부재 시 window.label, 그것도 없으면 kind 그대로.
// (provider 별 친화 라벨 — issue #116 의 "claude 예시" 스타일 정합)
const WINDOW_LABELS = Object.freeze({
  primary: 'Primary window',
  secondary: 'Secondary window',
  five_hour: 'Current session (5h)',
  seven_day: 'Current week (all models)',
  seven_day_sonnet: 'Current week (Sonnet only)',
  seven_day_opus: 'Current week (Opus only)',
});

/**
 * 컬러를 출력해도 안전한 환경인지 판단.
 *
 * 기준:
 *   - stream.isTTY 가 true (pipe / redirect 가 아님)
 *   - env.NO_COLOR 가 미설정 (no-color.org 컨벤션)
 *   - env.TERM 이 'dumb' 가 아님
 *
 * @param {{ stream: { isTTY?: boolean }|undefined, env: Record<string, string|undefined>|undefined }} ctx
 * @returns {boolean}
 */
export function shouldUseColor({ stream, env } = {}) {
  if (!stream || !stream.isTTY) return false;
  const envObj = env ?? {};
  if (envObj.NO_COLOR != null && envObj.NO_COLOR !== '') return false;
  if (envObj.TERM === 'dumb') return false;
  return true;
}

/**
 * usedPercent → 컬러 level mapping.
 *
 * @param {number|null|undefined} percent
 * @returns {'green'|'yellow'|'red'|null} null 이면 unknown (컬러 미적용)
 */
export function levelForPercent(percent) {
  if (percent == null || Number.isNaN(percent)) return null;
  if (percent < 50) return 'green';
  if (percent < 80) return 'yellow';
  return 'red';
}

/**
 * 텍스트에 ANSI 컬러를 입힌다. useColor=false 또는 level=null 이면 원문.
 *
 * @param {string} text
 * @param {'green'|'yellow'|'red'|null} level
 * @param {boolean} useColor
 * @returns {string}
 */
export function colorize(text, level, useColor) {
  if (!useColor || level == null) return text;
  const code = ANSI[level];
  if (!code) return text;
  return `${code}${text}${ANSI.reset}`;
}

/**
 * 0-100 백분율을 ASCII 막대 그래프로 렌더링. claude-code `/usage` 스타일.
 *
 * 정상 입력: `███▌` 형태 — 1/8 정밀도 fractional 블록 포함. 빈 자리는 space.
 * null/NaN: 전부 space (width 만큼). 범위 외 값은 0..100 으로 clamp.
 *
 * 양 끝 대괄호 없음 — multi-line block 의 한 줄로 사용되므로 percent / "used"
 * 와의 시각 정렬을 위해 width 만큼 padding 보장.
 *
 * 컬러는 levelForPercent 결정값으로 colorize 통과. useColor=false 면 plain.
 *
 * @param {number|null|undefined} percent
 * @param {{ width?: number, useColor?: boolean }} [options]
 * @returns {string} — 정확히 `width` 만큼의 visible 문자 (ANSI escape 는 +α)
 */
export function formatProgressBar(percent, options = {}) {
  const width = options.width ?? DEFAULT_BAR_WIDTH;
  const useColor = options.useColor ?? false;

  if (percent == null || Number.isNaN(percent)) {
    return ' '.repeat(width);
  }

  const clamped = Math.max(0, Math.min(100, percent));
  const totalEighths = Math.round((clamped / 100) * width * 8);
  const fullBlocks = Math.floor(totalEighths / 8);
  const remainder = totalEighths - fullBlocks * 8;

  let filled = '█'.repeat(fullBlocks);
  if (remainder > 0) {
    filled += FRACTIONAL_CHARS[remainder];
  }

  const visibleLen = filled.length;
  const trailing = ' '.repeat(Math.max(0, width - visibleLen));

  const level = levelForPercent(percent);
  const colored = colorize(filled, level, useColor);
  return colored + trailing;
}

/**
 * ISO 8601 reset 시각을 friendly local time 문자열로.
 * 예: `2pm (Asia/Seoul)`, `May 15, 3am (Asia/Seoul)`, `3:25pm (UTC)`.
 *
 * 같은 day (now 기준) → 시간만. 다른 day → `month day, time`.
 * 분이 0 이면 분 생략. timezone 은 Intl.DateTimeFormat resolvedOptions.
 *
 * 잘못된 입력 → 원문 또는 'unknown'.
 *
 * @param {string|null|undefined} isoDate
 * @param {Date} [now] — 동일 day 비교용. 테스트에서 주입.
 * @returns {string}
 */
export function formatResetTime(isoDate, now = new Date()) {
  if (!isoDate) return 'unknown';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return String(isoDate);

  let tz;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    tz = 'UTC';
  }

  const hour = d.getHours();
  const min = d.getMinutes();
  const ampm = hour < 12 ? 'am' : 'pm';
  const h12 = hour % 12 || 12;
  const timeStr = min === 0 ? `${h12}${ampm}` : `${h12}:${String(min).padStart(2, '0')}${ampm}`;

  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `${timeStr} (${tz})`;
  }
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}, ${timeStr} (${tz})`;
}

/**
 * window kind → 사람이 읽기 좋은 라벨.
 *
 * 우선순위: WINDOW_LABELS 매핑 (알려진 kind) → window.label (adapter 제공) →
 * kind → 'Window'. 매핑이 label 보다 우선하는 이유 — adapter 는 `${kind} window`
 * 같은 generic label 을 설정할 수 있으므로, formatter 레이어의 UX 결정인
 * 친화 라벨이 더 안정적인 정합.
 *
 * @param {{ kind?: string|null, label?: string|null }|null|undefined} window
 * @returns {string}
 */
export function formatWindowLabel(window) {
  const kind = window?.kind;
  if (kind && WINDOW_LABELS[kind]) return WINDOW_LABELS[kind];
  if (window?.label) return window.label;
  if (kind) return kind;
  return 'Window';
}
