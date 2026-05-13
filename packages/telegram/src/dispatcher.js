/**
 * MVP 5 명령 (status / status --json / usage / doctor / auth_list) 의 dispatcher
 * build helper. CLI 가 deps 로 core 함수를 주입하면 각 핸들러 factory 를 호출해
 * dispatcher 객체를 조립한다.
 *
 * Phase 3 (#128). 의존성 주입 패턴 — 본 패키지가 `@token-weather/cli` 를
 * 직접 import 하지 않고, runTelegramCommand 의 deps 매개변수가 통로.
 *
 * `--json` 분기는 본 모듈이 책임 — `/status` / `/usage` 가 args 에 `--json` 을
 * 포함하면 status-json-handler 로 위임, 아니면 status / usage handler.
 */

import { createStatusHandler } from './handlers/status-handler.js';
import { createStatusJsonHandler } from './handlers/status-json-handler.js';
import { createUsageHandler } from './handlers/usage-handler.js';
import { createDoctorHandler } from './handlers/doctor-handler.js';
import { createAuthListHandler } from './handlers/auth-list-handler.js';

/**
 * @typedef {object} TelegramDeps
 * @property {(options?: object) => Promise<object>} getStatusSnapshot
 * @property {(snapshot: object, ctx?: object) => string[]} formatStatusOutput
 * @property {(snapshot: object, meta?: object) => string} formatStatusJson
 * @property {() => Promise<object>} collectDoctorReport
 * @property {(report: object) => string[]} formatDoctorReportLines
 * @property {(provider?: string, opts?: object) => Promise<object>} collectAuthListData
 * @property {(data: object, opts?: object) => string[]} formatAuthListLines
 */

/**
 * MVP 5 명령 dispatcher 를 build 한다.
 *
 * @param {TelegramDeps} deps
 * @returns {Record<string, (ctx: object, args: string[]) => Promise<void>>}
 */
export function buildDispatcher(deps) {
  const statusHandler = createStatusHandler(deps);
  const statusJsonHandler = createStatusJsonHandler(deps, { command: 'status' });
  const usageJsonHandler = createStatusJsonHandler(deps, { command: 'usage' });
  const usageHandler = createUsageHandler(deps);
  const doctorHandler = createDoctorHandler(deps);
  const authListHandler = createAuthListHandler(deps);

  return {
    status: async (ctx, args) => {
      if (Array.isArray(args) && args.includes('--json')) {
        return statusJsonHandler(ctx, args);
      }
      return statusHandler(ctx, args);
    },
    // /usage 와 /usage --json 모두 JSON top-level `command` 가 'usage' 가
    // 되도록 별도 핸들러 인스턴스 사용 (CLI `runStatusCommand` 정합, PR #134
    // review).
    usage: async (ctx, args) => {
      if (Array.isArray(args) && args.includes('--json')) {
        return usageJsonHandler(ctx, args);
      }
      return usageHandler(ctx, args);
    },
    doctor: doctorHandler,
    auth_list: authListHandler,
  };
}
