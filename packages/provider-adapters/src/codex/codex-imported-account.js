import { mapCodexCredentials } from './map-codex-credentials.js';

/**
 * Codex CLI 가 저장한 OAuth tokens 객체를 본 도구 내부 account record 로 변환.
 * claude 측의 `buildImportedClaudeAccount` 와 1:1 대칭.
 *
 * source 는 `'codex-cli-import'`, accountKey 는 `'codex-cli-import'` (단일
 * fallback 계정 의미). 다중 계정은 agent-store 가 책임진다.
 *
 * 토큰만 통과 — identity (email / displayName) 보강은 downstream 의 토큰
 * 디코더 / refresh 흐름에서 채워진다.
 *
 * @param {object|null} tokens - `~/.codex/auth.json` 의 tokens 객체
 * @returns {object|null}
 */
export function buildImportedCodexAccount(tokens) {
  const cred = mapCodexCredentials(tokens);
  if (!cred) return null;

  return {
    provider: 'codex',
    source: 'codex-cli-import',
    accountKey: 'codex-cli-import',
    authType: 'oauth',
    accessToken: cred.accessToken,
    refreshToken: cred.refreshToken,
    idToken: cred.idToken,
    accountId: cred.accountId,
  };
}

/**
 * 단일 fallback Codex 계정을 list 로 wrap. claude 측의 `resolveImportedClaudeAccounts`
 * 와 대칭. 정상이면 `[account]`, 아니면 `[]`.
 *
 * @param {object|null} tokens
 * @returns {Array<object>}
 */
export function resolveImportedCodexAccounts(tokens) {
  const account = buildImportedCodexAccount(tokens);
  return account ? [account] : [];
}

/**
 * 우선순위 기반 selectable accounts + authSource 결정.
 * claude 측의 `selectClaudeAccountsSource` 와 1:1 대칭:
 *   1. agent-store accounts
 *   2. codex-cli-import accounts
 *   3. not-found
 *
 * @param {Array<object>} agentAccounts
 * @param {Array<object>} importedAccounts
 * @returns {{ accounts: Array<object>, authSource: string }}
 */
export function selectCodexAccountsSource(agentAccounts, importedAccounts) {
  if (agentAccounts.length > 0) {
    return { accounts: agentAccounts, authSource: 'agent-store' };
  }
  if (importedAccounts.length > 0) {
    return { accounts: importedAccounts, authSource: 'codex-cli-import' };
  }
  return { accounts: [], authSource: 'not-found' };
}

/**
 * Thin facade: `~/.codex/auth.json` 의 raw tokens 객체 → imported accounts +
 * authSource 한 번에. claude 측의 `resolveImportedClaudeSnapshot` 과 대칭.
 *
 * @param {object|null} tokens
 * @returns {{ accounts: Array<object>, authSource: string }}
 */
export function resolveImportedCodexSnapshot(tokens) {
  const importedAccounts = resolveImportedCodexAccounts(tokens);
  return selectCodexAccountsSource([], importedAccounts);
}
