/**
 * `/help` 명령 핸들러 — 사용 가능한 슬래시 명령 목록을 plain text 로 회신.
 *
 * issue #148. Telegram `setMyCommands` 자동완성 메뉴와 동일 source (BOT_COMMANDS)
 * 를 사용해 정합성을 보장. `<pre>` 미사용 — 일반 메시지로 보내 모바일 reflow.
 *
 * deps 인자는 받지 않음 — formatHelpText 가 BOT_COMMANDS 만 사용하는 pure 함수.
 */

import { formatHelpText } from '../bot-commands.js';

/**
 * @returns {(ctx: object, args: string[]) => Promise<void>}
 */
export function createHelpHandler() {
  return async function helpHandler(ctx, _args) {
    await ctx.reply(formatHelpText());
  };
}
