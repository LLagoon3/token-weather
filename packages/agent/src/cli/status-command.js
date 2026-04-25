import { getStatusSnapshot } from '../services/status-service.js';
import { parseCliOptions } from './parse-options.js';

// 포맷터는 status-formatters.js에서 관리. 기존 import 경로 호환을 위해 re-export.
export {
  formatStatusOutput,
  formatCodexSection,
  formatClaudeSection,
  formatClaudeNetworkUsages,
  formatClaudeNetworkUsageBody,
  formatClaudeNetworkUsage,
  formatClaudeLocalUsage,
  formatWindow,
} from './status-formatters.js';

import { formatStatusOutput } from './status-formatters.js';

export const STATUS_COMMANDS = ['status', 'usage'];

/**
 * `status` / `usage` 진입점.
 * 옵션 파싱 → snapshot 조회 → formatter → 출력.
 */
export async function runStatusCommand(command, args = []) {
  const options = parseStatusOptions(args);
  if (options.help) {
    for (const line of formatStatusHelp(command)) console.log(line);
    return;
  }
  const snapshot = await getStatusSnapshot({ accountFilter: options.account });
  for (const line of formatStatusOutput(command, snapshot)) {
    console.log(line);
  }
}

/**
 * `status` / `usage` 옵션 파서.
 */
export function parseStatusOptions(args) {
  return parseCliOptions(args, {
    defaults: { account: null },
    flags: {
      '--account': { key: 'account', type: 'string' },
    },
    includeHelp: true,
  });
}

/**
 * `status` / `usage` 커맨드의 --help 출력 줄을 반환한다. Pure function.
 */
export function formatStatusHelp(command = 'status') {
  return [
    `ai-usage-agent ${command} [options]`,
    '',
    'provider별 credential 상태와 live usage window를 출력합니다.',
    '여러 계정이 저장되어 있으면 기본적으로 모두 병렬 조회합니다.',
    '',
    'Options:',
    '  --account <id>   특정 계정만 조회 (email / accountKey / label, case-insensitive)',
    '  -h, --help       이 도움말 출력',
  ];
}
