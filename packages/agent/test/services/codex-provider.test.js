import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCodexSnapshot,
  selectCodexAuthSource,
  filterRealCodexAccounts,
} from '../../src/services/codex-provider.js';

// ── pure helpers ─────────────────────────────────────────────────────────────
// selectCodexAuthSource / filterRealCodexAccounts는 순수 함수로 이미 일부
// 커버되어 있지만(status-service.test.js에서 re-export 테스트 중), 여기서는
// provider 모듈 자체 경로(../services/codex-provider.js)로도 import 동작을 검증.

describe('selectCodexAuthSource (via codex-provider)', () => {
  it('agent-store preferred when non-empty', () => {
    const result = selectCodexAuthSource([{ id: 'a' }], [{ id: 'oc' }]);
    assert.equal(result.authSource, 'agent-store');
    assert.deepEqual(result.profiles, [{ id: 'a' }]);
  });

  it('falls back to openclaw-import when agent list is empty', () => {
    const result = selectCodexAuthSource([], [{ id: 'oc' }]);
    assert.equal(result.authSource, 'openclaw-import');
  });
});

describe('filterRealCodexAccounts (via codex-provider)', () => {
  it('keeps active accounts with real (non-mock) tokens', () => {
    const accounts = [
      { accountKey: 'real', status: 'active', tokens: { accessToken: 'real-x' } },
      { accountKey: 'mock', status: 'active', tokens: { accessToken: 'mock-y' } },
      {
        accountKey: 'flagged',
        status: 'active',
        tokens: { accessToken: 'z' },
        raw: { mock: true },
      },
      { accountKey: 'disabled', status: 'disabled', tokens: { accessToken: 'real-d' } },
    ];
    const result = filterRealCodexAccounts(accounts);
    assert.equal(result.length, 1);
    assert.equal(result[0].accountKey, 'real');
  });
});

// ── integration contract ────────────────────────────────────────────────────
// getCodexSnapshot은 auth-store I/O에 의존하므로 여기서는 구조 계약만 검증.
// disabled config → 항상 고정된 shape. live 케이스는 수동 smoke로 확인.

describe('getCodexSnapshot — disabled config contract', () => {
  it('returns enabled=false with empty snapshots when codex disabled', async () => {
    const snap = await getCodexSnapshot({ providers: { codex: { enabled: false } } });
    assert.equal(snap.enabled, false);
    assert.deepEqual(snap.snapshots, []);
    assert.equal(typeof snap.authProfilesPath, 'string');
  });
});
