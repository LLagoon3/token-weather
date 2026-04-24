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
  });
}
