#!/usr/bin/env node
import { runCli } from '../src/cli/run-cli.js';

runCli(process.argv.slice(2)).catch((error) => {
  console.error('[token-weather] 실행 중 오류가 발생했습니다.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
