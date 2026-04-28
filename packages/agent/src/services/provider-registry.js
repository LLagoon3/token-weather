import { getCodexSnapshot } from './codex-provider.js';
import { getClaudeSnapshot } from './claude-provider.js';

/**
 * Provider registry: 각 항목은 status snapshot의 최상위 키(`codex`, `claude` 등)에
 * 해당하는 결과를 만들어내는 async 함수를 가진다.
 *
 * 새 provider를 추가할 때는 여기에 spec을 한 줄 추가하고 config.providers 스키마에
 * 키를 더하면 된다.
 *
 * @typedef {object} ProviderSpec
 * @property {string} id                      - snapshot의 key (예: 'codex')
 * @property {(config: object, options?: RunOptions) => Promise<object>} getSnapshot
 *
 * @typedef {object} RunOptions
 * @property {string} [accountFilter] - email / accountKey (추후 label 포함) 중 하나.
 *   지정 시 각 provider는 매치되는 real 계정만 조회.
 * @property {string} [providerFilter] - registry id (현재 'codex' | 'claude').
 *   지정 시 해당 provider 한 곳만 snapshot을 만든다. 미일치 id는 빈 결과(`{}`).
 */

/** @type {ReadonlyArray<ProviderSpec>} */
export const PROVIDER_REGISTRY = Object.freeze([
  { id: 'codex', getSnapshot: getCodexSnapshot },
  { id: 'claude', getSnapshot: getClaudeSnapshot },
]);

/** registry에 등록된 provider id 목록(snapshot 키). */
export const PROVIDER_IDS = Object.freeze(PROVIDER_REGISTRY.map((p) => p.id));

/**
 * Run registered providers with the given config and return keyed snapshots.
 * CLI로 전달된 accountFilter가 있으면 그 값을 우선 적용하고, 없으면
 * config.defaults.profiles.<provider>로 fallback한다.
 *
 * `options.providerFilter`가 지정되면 해당 id의 provider만 실행한다.
 * (registry에 없는 id면 빈 객체를 반환 — CLI 레이어에서 미리 검증 권장.)
 *
 * @param {object} config
 * @param {RunOptions} [options]
 * @returns {Promise<Record<string, object>>}
 */
export async function runProviderSnapshots(config, options = {}) {
  const filter = options.providerFilter ?? null;
  const targets = filter ? PROVIDER_REGISTRY.filter((p) => p.id === filter) : PROVIDER_REGISTRY;
  const entries = await Promise.all(
    targets.map(async (p) => {
      const providerOptions = {
        ...options,
        accountFilter: options.accountFilter ?? config?.defaults?.profiles?.[p.id] ?? null,
      };
      return [p.id, await p.getSnapshot(config, providerOptions)];
    }),
  );
  return Object.fromEntries(entries);
}
