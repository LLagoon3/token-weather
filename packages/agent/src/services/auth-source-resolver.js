/**
 * 공통 auth source 우선순위 결정.
 *
 * 모든 provider가 동일한 패턴을 따른다:
 *   1. agent-store에 real 계정이 있으면 그것을 사용
 *   2. 없으면 import source들을 순서대로 시도 (첫 번째 비어있지 않은 것)
 *   3. 모두 비어있으면 'not-found'
 *
 * provider별 차이(Codex의 openclaw-import, Claude의 claude-cli-import 등)는
 * importSources 배열의 id 값으로만 구분된다.
 *
 * @param {Array<object>} agentAccounts - agent-store에서 읽은 real 계정 목록
 * @param {Array<{ id: string, accounts: Array<object> }>} [importSources=[]]
 *   fallback import source 후보들. 순서대로 시도.
 *   예: [{ id: 'openclaw-import', accounts: [...] }]
 *       [{ id: 'claude-cli-import', accounts: [...] }]
 * @returns {{ accounts: Array<object>, authSource: string }}
 */
export function resolveAuthSource(agentAccounts, importSources = []) {
  if (Array.isArray(agentAccounts) && agentAccounts.length > 0) {
    return { accounts: agentAccounts, authSource: 'agent-store' };
  }

  for (const source of importSources) {
    if (Array.isArray(source.accounts) && source.accounts.length > 0) {
      return { accounts: source.accounts, authSource: source.id };
    }
  }

  return { accounts: [], authSource: 'not-found' };
}
