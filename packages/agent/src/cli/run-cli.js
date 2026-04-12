import { STATUS_COMMANDS, runStatusCommand } from './status-command.js';
import { runDoctorCommand } from './doctor-command.js';
import { runConfigInitCommand } from './config-init-command.js';

export async function runCli(argv) {
  const [command = 'status', ...rest] = argv;

  if (STATUS_COMMANDS.includes(command)) {
    await runStatusCommand(command, rest);
    return;
  }

  if (command === 'doctor') {
    await runDoctorCommand();
    return;
  }

  if (command === 'config') {
    const [subcommand] = rest;
    if (subcommand === 'init') {
      await runConfigInitCommand();
      return;
    }
  }

  printHelp();
}

function printHelp() {
  console.log(`ai-usage-agent\n\n사용법:\n  ai-usage-agent status\n  ai-usage-agent usage\n  ai-usage-agent doctor\n  ai-usage-agent config init\n  ai-usage-agent inspect <provider>    # 예정\n  ai-usage-agent sync                 # 예정`);
}
