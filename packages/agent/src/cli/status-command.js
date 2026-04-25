import { getStatusSnapshot } from '../services/status-service.js';
import { PROVIDER_IDS } from '../services/provider-registry.js';
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
  // --account가 case-insensitive(`resolveAccountByIdentifier`)인 것과 일관되게,
  // --provider 값도 case-insensitive로 정규화한 뒤 PROVIDER_IDS와 비교한다.
  const providerFilter = normalizeProviderFilter(options.provider);
  if (options.provider && providerFilter === null) {
    console.error(
      `알 수 없는 provider: ${options.provider} (사용 가능: ${PROVIDER_IDS.join(', ')})`,
    );
    process.exitCode = 1;
    return;
  }
  const snapshot = await getStatusSnapshot({
    accountFilter: options.account,
    providerFilter,
  });
  for (const line of formatStatusOutput(command, snapshot)) {
    console.log(line);
  }
}

/**
 * --provider 입력값을 trim+lowercase한 뒤 PROVIDER_IDS와 매치되면 그 id를,
 * 입력이 없거나 매치되지 않으면 null을 반환한다. (case-insensitive)
 *
 * Pure helper — runner 외부에서 검증 단위 테스트로 호출 가능.
 */
export function normalizeProviderFilter(raw) {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '') return null;
  return PROVIDER_IDS.includes(normalized) ? normalized : null;
}

/**
 * `status` / `usage` 옵션 파서.
 */
export function parseStatusOptions(args) {
  return parseCliOptions(args, {
    defaults: { account: null, provider: null },
    flags: {
      '--account': { key: 'account', type: 'string' },
      '--provider': { key: 'provider', type: 'string' },
    },
    includeHelp: true,
  });
}

/**
 * `status` / `usage` 커맨드의 --help 출력 줄을 반환한다. Pure function.
 */
export function formatStatusHelp(command = 'status') {
  const providerList = PROVIDER_IDS.join(', ');
  return [
    `ai-usage-agent ${command} [options]`,
    '',
    'provider별 credential 상태와 live usage window를 출력합니다.',
    '여러 계정이 저장되어 있으면 기본적으로 모두 병렬 조회합니다.',
    '',
    'Options:',
    '  --account <id>     특정 계정만 조회 (email / accountKey / label, case-insensitive)',
    `  --provider <id>    특정 provider만 조회 (사용 가능: ${providerList}, case-insensitive)`,
    '  -h, --help         이 도움말 출력',
  ];
}
