import fs from 'node:fs/promises';
import { createDefaultConfig } from '../config/default-config.js';
import { resolveAgentConfigDir, resolveAgentConfigPath } from '../config/config-path.js';

/**
 * `config init` --help 출력. Pure function.
 */
export function formatConfigInitHelp() {
  return [
    'ai-usage-agent config init',
    '',
    '~/.config/ai-usage-agent/config.json에 기본 설정 파일을 생성합니다.',
    '',
    'Options:',
    '  -h, --help   이 도움말 출력',
  ];
}

export async function runConfigInitCommand(args = []) {
  const wantsHelp = (args ?? []).some((a) => a === '--help' || a === '-h');
  if (wantsHelp) {
    for (const line of formatConfigInitHelp()) console.log(line);
    return;
  }

  const dir = resolveAgentConfigDir();
  const file = resolveAgentConfigPath();
  const config = createDefaultConfig();

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  console.log(`기본 설정 파일을 생성했습니다: ${file}`);
}
