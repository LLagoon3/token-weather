/**
 * cli:status 평문 출력의 ASCII 막대 그래프 + ANSI 컬러 helper.
 *
 * 모든 함수는 pure — stream / env 는 호출자가 주입한다 (테스트 친화).
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

const DEFAULT_BAR_WIDTH = 20;

/**
 * 컬러를 출력해도 안전한 환경인지 판단.
 *
 * 기준:
 *   - stream.isTTY 가 true (pipe / redirect 가 아님)
 *   - env.NO_COLOR 가 미설정 (no-color.org 컨벤션)
 *   - env.TERM 이 'dumb' 가 아님 (dumb terminal 은 ANSI 미지원)
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
 * 텍스트에 ANSI 컬러를 입힌다. useColor=false 또는 level=null 이면 원문 반환.
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
 * 0-100 백분율을 ASCII 막대 그래프로 렌더링.
 *
 * 정상 입력: `[███████░░░░░░░░░░░░░]` (width 만큼의 채움/빈칸, 양 끝 대괄호 포함)
 * null/NaN/범위 외: `[n/a + 패딩]` — 같은 시각적 width 유지
 *
 * 컬러는 levelForPercent 결정값으로 colorize 통과. useColor=false 면 plain.
 *
 * @param {number|null|undefined} percent
 * @param {{ width?: number, useColor?: boolean }} [options]
 * @returns {string}
 */
export function formatProgressBar(percent, options = {}) {
  const width = options.width ?? DEFAULT_BAR_WIDTH;
  const useColor = options.useColor ?? false;

  if (percent == null || Number.isNaN(percent)) {
    const body = 'n/a'.padEnd(width);
    return `[${body}]`;
  }

  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const body = '█'.repeat(filled) + '░'.repeat(width - filled);
  const level = levelForPercent(percent);
  return `[${colorize(body, level, useColor)}]`;
}
