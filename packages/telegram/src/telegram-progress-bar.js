/**
 * Telegram 전용 짧은 ASCII progress bar.
 *
 * issue #146: PR #145 (#144) 의 모바일 친화 compact 출력에 사용량 시각화 막대를
 * 복원. CLI 의 `formatProgressBar` (packages/agent/src/cli/status-bar-helper.js)
 * 와 동일한 1/8 정밀도 fractional block 을 사용하되, ANSI 컬러 분기 / width=50
 * 가정 / `levelForPercent` 등 텔레그램에서 의미 없는 부분을 제거한 작은 사본.
 *
 * `@token-weather/telegram` 은 `@token-weather/cli` 를 직접 import 하지 않는다
 * (PR #131 review 정책). 사본 ~15 줄.
 *
 * 정밀도: 1/8 fractional block — `█▏▎▍▌▋▊▉`. 빈 자리는 light shade `░`.
 * 컬러: 미적용 (Telegram `<pre>` 는 monospace HTML, ANSI 미지원).
 */

const FRAC = Object.freeze(['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']);

/**
 * 0–100 백분율을 정확히 `width` 만큼의 visible 문자로 렌더링.
 *
 *   - null / NaN: 전부 `░` (pct 텍스트는 호출자가 `—` 등으로 표기 — 0% 와 혼동 회피)
 *   - 범위 외: `[0, 100]` clamp
 *   - 분수 8 분의 1 단위로 반올림 (예: 12.5% width=10 → `█░░░░░░░░░`,
 *     38% width=10 → `█▌░░░░░░░░`)
 *
 * @param {number|null|undefined} percent
 * @param {number} [width=10]
 * @returns {string} — 정확히 width visible 문자
 */
export function compactProgressBar(percent, width = 10) {
  if (percent == null || Number.isNaN(percent)) return '░'.repeat(width);
  const clamped = Math.max(0, Math.min(100, percent));
  const totalEighths = Math.round((clamped / 100) * width * 8);
  const fullBlocks = Math.floor(totalEighths / 8);
  const remainder = totalEighths - fullBlocks * 8;
  let filled = '█'.repeat(fullBlocks);
  if (remainder > 0) filled += FRAC[remainder];
  return filled + '░'.repeat(Math.max(0, width - filled.length));
}
