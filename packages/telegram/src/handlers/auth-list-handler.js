/**
 * `/auth_list` 명령 핸들러 — `runAuthListCommand` 의 데이터만 노출. 모든 provider
 * 의 계정 + claude import source 섹션. provider 필터 / --help 는 전달 안 함
 * (Phase 3 MVP 보안 표면 최소).
 *
 * Phase 3 (#128). 의존성 주입 — deps.collectAuthListData + deps.formatAuthListLines
 * 사용.
 */

import { formatPreChunksForTelegram } from '../formatters.js';

/**
 * @param {object} deps
 * @param {(provider?: string, opts?: object) => Promise<object>} deps.collectAuthListData
 * @param {(data: object, opts?: object) => string[]} deps.formatAuthListLines
 * @returns {(ctx: object, args: string[]) => Promise<void>}
 */
export function createAuthListHandler(deps) {
  return async function authListHandler(ctx, _args) {
    const data = await deps.collectAuthListData();
    const text = deps.formatAuthListLines(data).join('\n');
    const chunks = formatPreChunksForTelegram(text);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'HTML' });
    }
  };
}
