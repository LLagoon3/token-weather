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
 * @param {{ command?: 'status' | 'usage' }} [options]
 *   JSON contract 의 top-level `command` 필드에 박힐 값. CLI 의 `runStatusCommand`
 *   가 호출된 명령 이름 (`status` 또는 `usage`) 을 그대로 통과시키는 정합을
 *   유지하기 위해 dispatcher 가 명시적으로 주입 (PR #134 review).
 * @returns {(ctx: object, args: string[]) => Promise<void>}
 */
export function createStatusJsonHandler(deps, options = {}) {
  const command = options.command ?? 'status';
  return async function statusJsonHandler(ctx, _args) {
    const snapshot = await deps.getStatusSnapshot({});
    const json = deps.formatStatusJson(snapshot, { command });
    const chunks = formatPreChunksForTelegram(json);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'HTML' });
    }
  };
}
