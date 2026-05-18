/**
 * @token-weather/telegram — public API.
 *
 * Phase 3 (#128) — runTelegramCommand 가 dispatcher 를 build 하고 startBot 으로
 * long-poll daemon 을 띄운다. Phase 4 (#129) 에서 setup / check 서브명령이
 * 추가된다.
 *
 * ## 의존성 방향 (PR #131 review 정책)
 *
 * 본 패키지는 `@token-weather/cli` 를 import 하지 않는다. `runTelegramCommand`
 * 의 `deps` 매개변수가 CLI 가 주입하는 core 함수 묶음의 통로 — 순환 의존 회피.
 */

import fs from 'node:fs';

import { createBotServer } from './bot-server.js';
import { buildDispatcher } from './dispatcher.js';
import { runSetupSubcommand } from './setup-subcommand.js';
import { runCheckSubcommand } from './check-subcommand.js';
import { runUninstallServiceSubcommand } from './uninstall-service-subcommand.js';

export { createBotServer, handleTextMessage } from './bot-server.js';
export { buildDispatcher } from './dispatcher.js';
export { parseCommand, extractMention, listAvailableCommands } from './command-router.js';
export { authAllowlistMiddleware, maskUserId } from './auth-allowlist.js';
export {
  stripAnsi,
  wrapPre,
  splitForTelegram,
  formatPreChunksForTelegram,
  formatErrorForTelegram,
} from './formatters.js';
export { validateBotToken, generatePairingCode, runPairingBot } from './pairing.js';
export {
  linuxSystemdUnit,
  macosLaunchAgent,
  windowsTaskScheduler,
  pickServiceTemplate,
} from './os-service-templates.js';
export { runSetupSubcommand, formatTelegramSetupHelp } from './setup-subcommand.js';
export { runCheckSubcommand, formatTelegramCheckHelp } from './check-subcommand.js';
export {
  runUninstallServiceSubcommand,
  formatTelegramUninstallServiceHelp,
} from './uninstall-service-subcommand.js';
export {
  installOsService,
  uninstallOsService,
  installSystemdUnit,
  uninstallSystemdUnit,
  installLaunchAgent,
  uninstallLaunchAgent,
  installTaskScheduler,
  uninstallTaskScheduler,
  parseYesNo,
} from './os-service-installer.js';
export { escapeSystemdArg, escapePlistXml, escapeSchtasksArg } from './os-service-path-escape.js';
export {
  formatStatusForTelegram,
  compactResetTime,
  TELEGRAM_LINE_WIDTH,
} from './telegram-status-formatter.js';
export { compactProgressBar } from './telegram-progress-bar.js';
export { BOT_COMMANDS, formatHelpText } from './bot-commands.js';
export { createHelpHandler } from './handlers/help-handler.js';

let _activeServer = null;

/**
 * Telegram 봇 daemon 을 띄운다. long-poll 루프는 fire-and-forget 으로 시작되고,
 * lifecycle 핸들은 internal cache 에 저장된다.
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
  const server = createBotServer(config);
  await server.start();
  _activeServer = server;
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
 * `token-weather telegram <subcommand>` 의 진입점. Phase 3 에서는 `start`
 * 서브명령만 지원 (setup / check 는 Phase 4 #129).
 *
 * @param {string[]} argv - `token-weather telegram <subcommand> ...` 의 나머지 인자.
 * @param {import('./dispatcher.js').TelegramDeps & { resolveAgentConfigPath: () => string }} deps
 * @returns {Promise<void>}
 */
export async function runTelegramCommand(argv, deps) {
  const [subcommand, ...rest] = Array.isArray(argv) ? argv : [];
  if (subcommand === '--help' || subcommand === '-h') {
    for (const line of formatTelegramHelp()) console.log(line);
    return;
  }
  if (!subcommand || subcommand === 'start') {
    await runStartSubcommand(rest, deps);
    return;
  }
  if (subcommand === 'setup') {
    await runSetupSubcommand(rest, deps);
    return;
  }
  if (subcommand === 'check') {
    await runCheckSubcommand(rest, deps);
    return;
  }
  if (subcommand === 'uninstall-service') {
    await runUninstallServiceSubcommand(rest, deps);
    return;
  }
  console.error(`알 수 없는 telegram 서브명령: ${subcommand}`);
  for (const line of formatTelegramHelp()) console.error(line);
  process.exitCode = 1;
}

/**
 * `token-weather telegram --help` 출력. Pure function.
 */
export function formatTelegramHelp() {
  return [
    'token-weather telegram <subcommand>',
    '',
    'Telegram 봇 daemon 으로 status / usage / doctor / auth list 명령을 원격 호출.',
    '',
    'Subcommands:',
    '  setup              대화형 봇 토큰 등록 + 페어링 + OS service 자동 등록 / template 안내',
    '  start              Telegram 봇 long-poll daemon 시작 (foreground, Ctrl+C 종료)',
    '  check              설정 / token / linger 상태 read-only 진단',
    '  uninstall-service  setup 으로 등록된 OS service 제거 (config 는 유지)',
    '',
    'Options:',
    '  -h, --help   이 도움말 출력',
  ];
}

/**
 * `token-weather telegram start --help` 출력. Pure function. (PR #134 review —
 * subcommand 별 --help 패턴이 다른 서브명령 (auth login / status / doctor) 과
 * 정합되도록 분리.)
 */
export function formatTelegramStartHelp() {
  return [
    'token-weather telegram start [options]',
    '',
    'Telegram 봇 long-poll daemon 을 foreground 로 시작합니다. Ctrl+C 로 종료.',
    '',
    'Options:',
    '  -h, --help   이 도움말 출력',
    '',
    '활성화 사전 조건 (Phase 4 의 `telegram setup` 명령이 자동 갱신):',
    '  - config.channels.telegram.enabled === true',
    '  - config.channels.telegram.botToken 비어 있지 않음',
    '  - config.channels.telegram.allowedUserIds 1 개 이상',
  ];
}

async function runStartSubcommand(args, deps) {
  if (Array.isArray(args) && (args.includes('--help') || args.includes('-h'))) {
    for (const line of formatTelegramStartHelp()) console.log(line);
    return;
  }
  if (!deps?.resolveAgentConfigPath) {
    throw new Error('runTelegramCommand: deps.resolveAgentConfigPath 가 필요합니다.');
  }
  const configPath = deps.resolveAgentConfigPath();
  if (!fs.existsSync(configPath)) {
    console.error(`설정 파일이 없습니다: ${configPath}`);
    console.error('먼저 `token-weather config init` 으로 생성한 뒤,');
    console.error('Phase 4 의 `token-weather telegram setup` 으로 봇 토큰 / 페어링을 완료하세요.');
    process.exitCode = 1;
    return;
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error(`설정 파일 파싱 실패: ${configPath}`);
    console.error(`  ${err?.message ?? err}`);
    process.exitCode = 1;
    return;
  }
  const tg = config.channels?.telegram;
  if (!tg?.enabled) {
    console.error(
      'Telegram 봇이 비활성화 상태입니다 (config.channels.telegram.enabled === false).',
    );
    console.error('Phase 4 의 `token-weather telegram setup` 으로 활성화하세요.');
    process.exitCode = 1;
    return;
  }
  if (!tg.botToken) {
    console.error('Telegram bot token 이 설정되지 않았습니다 (channels.telegram.botToken).');
    process.exitCode = 1;
    return;
  }
  if (!Array.isArray(tg.allowedUserIds) || tg.allowedUserIds.length === 0) {
    console.error('Telegram allowedUserIds 가 비어 있습니다. setup 으로 페어링을 완료하세요.');
    process.exitCode = 1;
    return;
  }
  const dispatcher = buildDispatcher(deps);
  await startBot({
    botToken: tg.botToken,
    allowedUserIds: tg.allowedUserIds,
    dispatcher,
  });
  console.log('[token-weather/telegram] daemon 시작. Ctrl+C 로 종료.');
}
