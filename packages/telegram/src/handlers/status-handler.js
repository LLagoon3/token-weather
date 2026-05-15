/**
 * `/status` 명령 핸들러 — Telegram 전용 compact 포맷으로 <pre> 응답.
 *
 * Phase 3 (#128) 에서 도입, issue #144 로 CLI 의 formatStatusOutput (데스크탑
 * 박스 / heavy rule / 50-column progress bar) 대신 본 패키지의
 * formatStatusForTelegram 을 사용하도록 교체. 텔레그램 모바일 폭 (~30–40
 * column) 에서 박스가 wrap 으로 깨지는 회귀 해소.
 *
 * 의존성 주입은 `deps.getStatusSnapshot` 만 — 텍스트 가공은 본 패키지가
 * 책임지므로 `formatStatusOutput` deps 의존이 제거되었음. dispatcher 의
 * `--json` 분기는 본 핸들러 책임이 아님 (status-json-handler).
 */

import { formatPreChunksForTelegram } from '../formatters.js';
import { formatStatusForTelegram } from '../telegram-status-formatter.js';

/**
 * @param {object} deps
 * @param {(options?: object) => Promise<object>} deps.getStatusSnapshot
 * @returns {(ctx: object, args: string[]) => Promise<void>}
 */
export function createStatusHandler(deps) {
  return async function statusHandler(ctx, _args) {
    const snapshot = await deps.getStatusSnapshot({});
    const text = formatStatusForTelegram(snapshot).join('\n');
    const chunks = formatPreChunksForTelegram(text);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'HTML' });
    }
  };
}
