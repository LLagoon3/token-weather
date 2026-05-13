/**
 * `/doctor` 명령 핸들러 — `runDoctorRoot` 의 데이터만 (기본 호출) 노출. 인자 /
 * subcommand 는 전달하지 않음 (Phase 3 plan 결정 — MVP 보안 표면 최소).
 *
 * Phase 3 (#128). 의존성 주입 — deps.collectDoctorReport +
 * deps.formatDoctorReportLines 를 통해 cli 의 데이터를 받는다. 본 패키지가
 * cli 를 import 하지 않는 정책 유지.
 */

import { formatPreChunksForTelegram } from '../formatters.js';

/**
 * @param {object} deps
 * @param {() => Promise<{configPath: string, claudeSnapshot: object}>} deps.collectDoctorReport
 * @param {(report: object) => string[]} deps.formatDoctorReportLines
 * @returns {(ctx: object, args: string[]) => Promise<void>}
 */
export function createDoctorHandler(deps) {
  return async function doctorHandler(ctx, _args) {
    const report = await deps.collectDoctorReport();
    const text = deps.formatDoctorReportLines(report).join('\n');
    const chunks = formatPreChunksForTelegram(text);
    for (const chunk of chunks) {
      await ctx.reply(chunk, { parse_mode: 'HTML' });
    }
  };
}
