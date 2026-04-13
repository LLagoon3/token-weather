import { STATUS_COMMANDS, runStatusCommand } from './status-command.js';
import { runDoctorCommand } from './doctor-command.js';
import { runConfigInitCommand } from './config-init-command.js';
import { runAuthLoginCommand } from './auth-login-command.js';
import { runAuthListCommand } from './auth-list-command.js';
import { runAuthLogoutCommand } from './auth-logout-command.js';
import { runAuthImportCommand } from './auth-import-command.js';

export async function runCli(argv) {
  const [command = 'status', ...rest] = argv;

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
    const [subcommand] = rest;
    if (subcommand === 'init') {
      await runConfigInitCommand();
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

  printHelp();
}

function printHelp() {
  console.log(`ai-usage-agent\n\n사용법:\n  ai-usage-agent status\n  ai-usage-agent usage\n  ai-usage-agent doctor\n  ai-usage-agent config init\n  ai-usage-agent auth login <provider>\n  ai-usage-agent auth list [provider]\n  ai-usage-agent auth import <provider>\n  ai-usage-agent auth logout <provider> [--account <id>]\n  ai-usage-agent inspect <provider>    # 예정\n  ai-usage-agent sync                 # 예정`);
}
