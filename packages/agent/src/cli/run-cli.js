import { STATUS_COMMANDS, runStatusCommand, formatStatusHelp } from './status-command.js';
import { runDoctorCommand, formatDoctorHelp } from './doctor-command.js';
import { runConfigInitCommand, formatConfigInitHelp } from './config-init-command.js';
import { runAuthLoginCommand, formatAuthLoginHelp } from './auth-login-command.js';
import { runAuthListCommand, formatAuthListHelp } from './auth-list-command.js';
import { runAuthLogoutCommand, formatAuthLogoutHelp } from './auth-logout-command.js';
import { runAuthImportCommand, formatAuthImportHelp } from './auth-import-command.js';

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

  for (const line of formatGlobalHelp()) console.log(line);
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
    'ai-usage-agent',
    '',
    '사용법:',
    ...subcommands.map((line) => `  ${line}`),
    '  ai-usage-agent inspect <provider>    # 예정',
    '  ai-usage-agent sync                  # 예정',
    '',
    '각 커맨드의 상세 옵션은 `<command> --help`로 확인하세요.',
  ];
}
