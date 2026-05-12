import { getStatusSnapshot } from '../services/status-service.js';
import { PROVIDER_IDS } from '../services/provider-registry.js';
import { parseCliOptions } from './parse-options.js';
import { formatStatusJson } from './status-json.js';
import { shouldUseColor } from './status-bar-helper.js';

// 포맷터는 status-formatters.js에서 관리. 기존 import 경로 호환을 위해 re-export.
export {
  formatStatusOutput,
  formatCodexSection,
  formatClaudeSection,
  formatClaudeNetworkUsages,
  formatClaudeNetworkUsageBody,
  formatClaudeNetworkUsage,
  formatWindowBlock,
} from './status-formatters.js';

import { formatStatusOutput } from './status-formatters.js';

export const STATUS_COMMANDS = ['status', 'usage'];

/**
 * `status` / `usage` entry point.
 * Parse options → fetch snapshot → format → print.
 */
export async function runStatusCommand(command, args = []) {
  const options = parseStatusOptions(args);
  if (options.help) {
    for (const line of formatStatusHelp(command)) console.log(line);
    return;
  }
  // `--account` 와 일관되게 `--provider` 도 case-insensitive 정규화.
  const providerFilter = normalizeProviderFilter(options.provider);
  if (options.provider && providerFilter === null) {
    console.error(`Unknown provider: ${options.provider} (available: ${PROVIDER_IDS.join(', ')})`);
    process.exitCode = 1;
    return;
  }
  const snapshot = await getStatusSnapshot({
    accountFilter: options.account,
    providerFilter,
  });

  if (options.json) {
    console.log(formatStatusJson(snapshot, { command }));
    return;
  }

  const useColor = shouldUseColor({ stream: process.stdout, env: process.env });
  for (const line of formatStatusOutput(command, snapshot, { useColor })) {
    console.log(line);
  }
}

/**
 * `--provider` 입력을 trim+lowercase 한 뒤 PROVIDER_IDS 와 매치되면 그 id 를,
 * 입력이 없거나 매치되지 않으면 null 을 반환. Pure helper.
 */
export function normalizeProviderFilter(raw) {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '') return null;
  return PROVIDER_IDS.includes(normalized) ? normalized : null;
}

/** `status` / `usage` 옵션 파서. */
export function parseStatusOptions(args) {
  return parseCliOptions(args, {
    defaults: { account: null, provider: null, json: false },
    flags: {
      '--account': { key: 'account', type: 'string' },
      '--provider': { key: 'provider', type: 'string' },
      '--json': { key: 'json', type: 'boolean' },
    },
    includeHelp: true,
  });
}

/** `status` / `usage` 의 --help 출력 라인. Pure function. */
export function formatStatusHelp(command = 'status') {
  const providerList = PROVIDER_IDS.join(', ');
  return [
    `token-weather ${command} [options]`,
    '',
    'Show provider credential status and live usage windows.',
    'Multiple accounts are queried in parallel by default.',
    '',
    'Options:',
    '  --account <id>     Only query the matching account (email / accountKey / label, case-insensitive)',
    `  --provider <id>    Only query the matching provider (available: ${providerList}, case-insensitive)`,
    '  --json             Print a single normalized JSON line to stdout (for automation / dashboards)',
    '  -h, --help         Show this help message',
  ];
}
