import { pathToFileURL } from 'node:url';
import { runCli } from './cli/run-cli.js';

export * from './cli/run-cli.js';
export * from './config/default-config.js';
export * from './services/status-service.js';
export * from './auth/index.js';

const entryArg = process.argv[1];
const isDirectRun = entryArg && import.meta.url === pathToFileURL(entryArg).href;

if (isDirectRun) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error('[ai-usage-agent] 실행 중 오류가 발생했습니다.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
