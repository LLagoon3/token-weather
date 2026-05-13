/**
 * `/status --json` (또는 `/usage --json`) 명령 핸들러 — formatStatusJson 결과를
 * `<pre>` 블록으로 wrap 해 Telegram 으로 전송.
 *
 * Phase 3 (#128). 의존성 주입 패턴 — status-handler 와 동일 deps 를 받지만
 * formatStatusJson 만 사용. JSON 한 줄 contract 를 그대로 노출 (외부 자동화 /
 * 대시보드가 봇을 통해 동일 contract 소비 가능).
 */

import { formatPreChunksForTelegram } from '../formatters.js';

/**
 * @param {object} deps
 * @param {(options?: object) => Promise<object>} deps.getStatusSnapshot
 * @param {(snapshot: object, meta?: object) => string} deps.formatStatusJson
 * @returns {(ctx: object, args: string[]) => Promise<void>}
 */
export function createStatusJsonHandler(deps) {
  return async function statusJsonHandler(ctx, _args) {
    const snapshot = await deps.getStatusSnapshot({});
    const json = deps.formatStatusJson(snapshot, { command: 'status' });
    const chunks = formatPreChunksForTelegram(json);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'HTML' });
    }
  };
}
