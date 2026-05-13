/**
 * `/usage` 명령 핸들러 — `/status` 의 alias (CLI 의 status / usage 가 동일
 * 출력 contract 를 공유하는 것과 정합).
 *
 * 별도 파일로 두는 이유: 향후 usage 만 다른 시각화 (예: 누적 시간축) 로
 * 분기될 가능성 대비. 현재는 status-handler 의 thin re-export.
 */

import { createStatusHandler } from './status-handler.js';

/**
 * @param {object} deps - status-handler 와 동일 deps.
 * @returns {(ctx: object, args: string[]) => Promise<void>}
 */
export function createUsageHandler(deps) {
  return createStatusHandler(deps);
}
