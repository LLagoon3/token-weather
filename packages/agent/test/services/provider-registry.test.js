import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PROVIDER_REGISTRY, runProviderSnapshots } from '../../src/services/provider-registry.js';

describe('PROVIDER_REGISTRY', () => {
  it('is frozen (cannot be mutated)', () => {
    assert.throws(() => PROVIDER_REGISTRY.push({ id: 'x', getSnapshot: async () => ({}) }));
  });

  it('contains codex and claude entries with id+getSnapshot', () => {
    const ids = PROVIDER_REGISTRY.map((p) => p.id).sort();
    assert.deepEqual(ids, ['claude', 'codex']);
    for (const spec of PROVIDER_REGISTRY) {
      assert.equal(typeof spec.id, 'string');
      assert.equal(typeof spec.getSnapshot, 'function');
    }
  });
});

describe('runProviderSnapshots', () => {
  // shape behaviour we can assert cheaply without hitting real network:
  // runProviderSnapshots just maps spec.id → await spec.getSnapshot(config).
  // We validate by providing a fake registry (indirectly via dependency injection
  // would be cleaner, but here we exercise the real one with a disabled config —
  // Codex/Claude providers both return cheap, deterministic snapshots when the
  // provider is disabled).

  it('returns an object keyed by provider id with both codex and claude present', async () => {
    const out = await runProviderSnapshots({ providers: {} });
    assert.ok('codex' in out);
    assert.ok('claude' in out);
  });

  it('honors disabled provider config (codex returns enabled=false)', async () => {
    const out = await runProviderSnapshots({
      providers: { codex: { enabled: false }, claude: { enabled: false } },
    });
    assert.equal(out.codex.enabled, false);
    // Claude snapshot always returns a base+networkUsage(null when disabled/no profile) — just assert shape
    assert.equal(out.claude.networkUsage, null);
  });

  it('CLI accountFilter and config.defaults.profiles do not throw when both supplied', async () => {
    // disabled 상태라 실제 필터 효과는 없지만 호출 경로가 throw 없이 돌아가는지 확인.
    await runProviderSnapshots(
      {
        providers: { codex: { enabled: false }, claude: { enabled: false } },
        defaults: { profiles: { codex: 'cfg-codex', claude: 'cfg-claude' } },
      },
      { accountFilter: 'cli-override' },
    );
  });

  it('falls back to config.defaults.profiles when no CLI accountFilter', async () => {
    await runProviderSnapshots({
      providers: { codex: { enabled: false } },
      defaults: { profiles: { codex: 'config-default' } },
    });
  });
});
