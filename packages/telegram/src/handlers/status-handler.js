/**
 * `/status` 명령 핸들러 — 평문 (formatStatusOutput) 출력을 Telegram 으로 전송.
 *
 * Phase 3 (#128). 의존성 주입 — `@token-weather/cli` 의 core 함수를 deps 로
 * 받아 사용하고, 본 패키지는 cli 를 직접 import 하지 않는다 (순환 회피 정책).
 *
 * `--json` 분기는 dispatcher 가 책임 — 본 핸들러는 단일 책임 (평문 출력).
 */

import { formatPreChunksForTelegram } from '../formatters.js';

/**
 * @param {object} deps
 * @param {(options?: object) => Promise<object>} deps.getStatusSnapshot
 * @param {(snapshot: object, ctx?: object) => string[]} deps.formatStatusOutput
 * @returns {(ctx: object, args: string[]) => Promise<void>}
 */
export function createStatusHandler(deps) {
  return async function statusHandler(ctx, _args) {
    const snapshot = await deps.getStatusSnapshot({});
    const text = deps.formatStatusOutput(snapshot, { useColor: false }).join('\n');
    const chunks = formatPreChunksForTelegram(text);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'HTML' });
    }
  };
}
