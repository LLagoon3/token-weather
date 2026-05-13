/**
 * @token-weather/telegram — public API.
 *
 * Phase 2 (#127) 부터 createBotServer / startBot / stopBot 가 실제 long-poll
 * daemon 을 띄운다. `runTelegramCommand` 는 여전히 Phase 1 placeholder —
 * Phase 3 (#128) 에서 dispatcher 를 채우고 `run-cli` 와 연결한다.
 *
 * ## 의존성 방향 (PR #131 review 정책)
 *
 * 본 패키지는 `@token-weather/cli` 를 import 하지 않는다. `runTelegramCommand`
 * 의 `deps` 매개변수가 CLI 가 주입하는 core 함수 묶음 (getStatusSnapshot /
 * formatStatusOutput / formatStatusJson / collectDoctorReport /
 * collectAuthListData / resolveAgentConfigPath) 의 통로 — 순환 의존 회피.
 */

import { createBotServer } from './bot-server.js';

export { createBotServer } from './bot-server.js';
export { parseCommand, listAvailableCommands } from './command-router.js';
export { authAllowlistMiddleware, maskUserId } from './auth-allowlist.js';
export { stripAnsi, wrapPre, splitForTelegram, formatErrorForTelegram } from './formatters.js';

let _activeServer = null;

/**
 * Telegram 봇 daemon 을 띄운다. long-poll 루프는 fire-and-forget 으로 시작되고,
 * lifecycle 핸들은 internal cache 에 저장된다. process 가 살아 있는 동안 daemon
 * 이 계속 돈다고 가정해도 된다.
 *
 * @param {import('./bot-server.js').BotServerOptions} config
 * @returns {Promise<import('./bot-server.js').BotServer>}
 */
export async function startBot(config) {
  if (_activeServer) {
    throw new Error(
      'startBot: Telegram bot is already running in this process (single-instance lock).',
    );
  }
  _activeServer = createBotServer(config);
  await _activeServer.start();
  return _activeServer;
}

/**
 * 현재 프로세스에서 띄운 daemon 을 graceful 하게 종료한다. 미작동 상태면 noop.
 */
export async function stopBot() {
  if (!_activeServer) return;
  await _activeServer.stop();
  _activeServer = null;
}

/**
 * `@token-weather/cli` 의 `run-cli` 가 `telegram` 서브명령에서 dynamic import 로
 * 호출하는 진입점. Phase 3 (#128) 에서 setup / check / start subcommand dispatch
 * 가 채워진다.
 *
 * @param {string[]} _argv - `token-weather telegram <subcommand> ...` 의 나머지 인자.
 * @param {object} [_deps] - CLI 가 주입하는 core 함수 묶음.
 * @returns {Promise<void>}
 */
export async function runTelegramCommand(_argv, _deps) {
  throw new Error(
    'token-weather telegram: 아직 구현되지 않았습니다 (5-phase plan 진행 중 — Phase 3 에서 활성화)',
  );
}
