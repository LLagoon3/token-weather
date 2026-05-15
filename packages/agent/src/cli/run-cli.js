import { STATUS_COMMANDS, runStatusCommand, formatStatusHelp } from './status-command.js';
import {
  runDoctorCommand,
  formatDoctorHelp,
  collectDoctorReport,
  formatDoctorReportLines,
} from './doctor-command.js';
import { runConfigInitCommand, formatConfigInitHelp } from './config-init-command.js';
import { runAuthLoginCommand, formatAuthLoginHelp } from './auth-login-command.js';
import {
  runAuthListCommand,
  formatAuthListHelp,
  collectAuthListData,
  formatAuthListLines,
} from './auth-list-command.js';
import { runAuthLogoutCommand, formatAuthLogoutHelp } from './auth-logout-command.js';
import { runAuthImportCommand, formatAuthImportHelp } from './auth-import-command.js';

import { getStatusSnapshot } from '../services/status-service.js';
import { formatStatusJson } from './status-json.js';
import { resolveAgentConfigPath } from '../config/config-path.js';
import { createDefaultConfig } from '../config/default-config.js';

/**
 * CLI 진입점. `bin/token-weather.js`가 process.argv.slice(2)를 그대로 전달.
 *
 * @param {string[]} argv - CLI 인자 배열 (`['status', '--json']` 등).
 * @returns {Promise<void>} 모든 서브커맨드는 stdout/stderr로 출력하고 void 반환.
 */
export async function runCli(argv) {
  const [command = 'status', ...rest] = argv;

  // 전역 --help / -h: 커맨드 없이 주면 global help 출력.
  if (command === '--help' || command === '-h') {
    for (const line of formatGlobalHelp()) console.log(line);
    return;
  }

  if (STATUS_COMMANDS.includes(command)) {
    await runStatusCommand(command, rest);
    return;
  }

  if (command === 'doctor') {
    const [subcommand, ...args] = rest;
    await runDoctorCommand(subcommand, args);
    return;
  }

  if (command === 'config') {
    const [subcommand, ...args] = rest;
    if (subcommand === 'init') {
      await runConfigInitCommand(args);
      return;
    }
  }

  if (command === 'auth') {
    const [subcommand, provider, ...args] = rest;
    if (subcommand === 'login') {
      await runAuthLoginCommand(provider, args);
      return;
    }
    if (subcommand === 'list') {
      await runAuthListCommand(provider);
      return;
    }
    if (subcommand === 'logout') {
      await runAuthLogoutCommand(provider, args);
      return;
    }
    if (subcommand === 'import') {
      await runAuthImportCommand(provider, args);
      return;
    }
  }

  if (command === 'telegram') {
    await runTelegramSubcommand(rest);
    return;
  }

  for (const line of formatGlobalHelp()) console.log(line);
}

/**
 * `token-weather telegram <subcommand>` 진입점. `@token-weather/telegram` 을
 * dynamic import 로 호출 (미설치 시 친절한 안내). cli 의 core 함수 묶음을
 * deps 로 주입 — telegram 패키지가 cli 를 직접 import 하지 않는 정책 유지.
 */
async function runTelegramSubcommand(argv) {
  let telegram;
  try {
    telegram = await import('@token-weather/telegram');
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND' || err?.code === 'MODULE_NOT_FOUND') {
      console.error('@token-weather/telegram 패키지가 설치되지 않았습니다.');
      console.error('  npm install @token-weather/telegram');
      process.exitCode = 1;
      return;
    }
    throw err;
  }
  const deps = {
    getStatusSnapshot,
    formatStatusJson,
    collectDoctorReport,
    formatDoctorReportLines,
    collectAuthListData,
    formatAuthListLines,
    resolveAgentConfigPath,
    createDefaultConfig,
  };
  await telegram.runTelegramCommand(argv, deps);
}

/**
 * 전역 help — 각 서브커맨드의 첫 줄(one-liner)을 모아 요약 목록을 출력한다.
 * 상세 옵션은 각 서브커맨드의 `--help`로 확인.
 * Pure function.
 */
export function formatGlobalHelp() {
  const subcommands = [
    formatStatusHelp('status')[0],
    formatStatusHelp('usage')[0],
    formatDoctorHelp()[0],
    formatConfigInitHelp()[0],
    formatAuthLoginHelp()[0],
    formatAuthListHelp()[0],
    formatAuthImportHelp()[0],
    formatAuthLogoutHelp()[0],
  ];
  return [
    'token-weather',
    '',
    '사용법:',
    ...subcommands.map((line) => `  ${line}`),
    '  token-weather telegram start        # Telegram 봇 daemon (Phase 3, setup 은 Phase 4)',
    '  token-weather inspect <provider>    # 예정',
    '  token-weather sync                  # 예정',
    '',
    '각 커맨드의 상세 옵션은 `<command> --help`로 확인하세요.',
  ];
}
