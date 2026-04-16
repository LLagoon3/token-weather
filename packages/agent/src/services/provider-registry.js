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
 */

/** @type {ReadonlyArray<ProviderSpec>} */
export const PROVIDER_REGISTRY = Object.freeze([
  { id: 'codex', getSnapshot: getCodexSnapshot },
  { id: 'claude', getSnapshot: getClaudeSnapshot },
]);

/**
 * Run all registered providers with the given config and return keyed snapshots.
 * CLI로 전달된 accountFilter가 있으면 그 값을 우선 적용하고, 없으면
 * config.defaults.profiles.<provider>로 fallback한다.
 *
 * @param {object} config
 * @param {RunOptions} [options]
 * @returns {Promise<Record<string, object>>}
 */
export async function runProviderSnapshots(config, options = {}) {
  const entries = await Promise.all(
    PROVIDER_REGISTRY.map(async (p) => {
      const providerOptions = {
        ...options,
        accountFilter:
          options.accountFilter
            ?? config?.defaults?.profiles?.[p.id]
            ?? null,
      };
      return [p.id, await p.getSnapshot(config, providerOptions)];
    }),
  );
  return Object.fromEntries(entries);
}
