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
 * @property {(config: object) => Promise<object>} getSnapshot
 */

/** @type {ReadonlyArray<ProviderSpec>} */
export const PROVIDER_REGISTRY = Object.freeze([
  { id: 'codex', getSnapshot: getCodexSnapshot },
  { id: 'claude', getSnapshot: getClaudeSnapshot },
]);

/**
 * Run all registered providers with the given config and return keyed snapshots.
 * @param {object} config
 * @returns {Promise<Record<string, object>>}
 */
export async function runProviderSnapshots(config) {
  const entries = await Promise.all(
    PROVIDER_REGISTRY.map(async (p) => [p.id, await p.getSnapshot(config)]),
  );
  return Object.fromEntries(entries);
}
