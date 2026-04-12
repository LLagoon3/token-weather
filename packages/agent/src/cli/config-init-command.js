import fs from 'node:fs/promises';
import { createDefaultConfig } from '../config/default-config.js';
import { resolveAgentConfigDir, resolveAgentConfigPath } from '../config/config-path.js';

export async function runConfigInitCommand() {
  const dir = resolveAgentConfigDir();
  const file = resolveAgentConfigPath();
  const config = createDefaultConfig();

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  console.log(`기본 설정 파일을 생성했습니다: ${file}`);
}
