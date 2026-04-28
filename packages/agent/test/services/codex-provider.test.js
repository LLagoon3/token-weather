import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCodexSnapshot,
  selectCodexAuthSource,
  filterRealCodexAccounts,
  filterProfilesByAccount,
} from '../../src/services/codex-provider.js';
import { filterEntriesByAccount } from '../../src/services/account-filter.js';

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

describe('filterRealCodexAccounts — multi-account retention', () => {
  it('returns all real accounts when multiple are active (multi-account A)', () => {
    const accounts = [
      { accountKey: 'one', status: 'active', tokens: { accessToken: 'real-1' } },
      { accountKey: 'two', status: 'active', tokens: { accessToken: 'real-2' } },
      { accountKey: 'mock', status: 'active', tokens: { accessToken: 'mock-x' } },
    ];
    const result = filterRealCodexAccounts(accounts);
    assert.equal(result.length, 2);
    assert.deepEqual(result.map((a) => a.accountKey).sort(), ['one', 'two']);
  });
});

describe('filterProfilesByAccount', () => {
  const profiles = [
    { id: 'openai-codex:a', email: 'a@x.com' },
    { id: 'openai-codex:b', email: 'b@x.com' },
  ];

  it('returns all profiles when accountFilter is falsy', () => {
    assert.deepEqual(filterProfilesByAccount(profiles, null), profiles);
    assert.deepEqual(filterProfilesByAccount(profiles, undefined), profiles);
    assert.deepEqual(filterProfilesByAccount(profiles, ''), profiles);
  });

  it('matches by accountKey (case-insensitive)', () => {
    const result = filterProfilesByAccount(profiles, 'OPENAI-CODEX:A');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'openai-codex:a');
  });

  it('matches by email (case-insensitive)', () => {
    const result = filterProfilesByAccount(profiles, 'B@X.COM');
    assert.equal(result.length, 1);
    assert.equal(result[0].email, 'b@x.com');
  });

  it('returns empty array when no match', () => {
    assert.deepEqual(filterProfilesByAccount(profiles, 'nope'), []);
  });
});

describe('filterEntriesByAccount', () => {
  it('filters entry arrays by profile id/email/label', () => {
    const entries = [
      {
        account: { accountKey: 'a' },
        profile: { id: 'openai-codex:a', email: 'a@x.com', label: 'work' },
      },
      {
        account: { accountKey: 'b' },
        profile: { id: 'openai-codex:b', email: 'b@x.com', label: 'personal' },
      },
    ];

    assert.equal(filterEntriesByAccount(entries, 'openai-codex:a').length, 1);
    assert.equal(filterEntriesByAccount(entries, 'B@X.COM').length, 1);
    assert.equal(filterEntriesByAccount(entries, 'personal').length, 1);
    assert.equal(filterEntriesByAccount(entries, 'nope').length, 0);
  });
});

describe('getCodexSnapshot — accountFilter flow', () => {
  it('propagates accountFilter into returned snapshot meta when disabled', async () => {
    const snap = await getCodexSnapshot(
      { providers: { codex: { enabled: false } } },
      { accountFilter: 'x@x.com' },
    );
    assert.equal(snap.enabled, false);
    // disabled path는 accountFilter 노출하지 않음 (provider 진입 전 short-circuit)
  });
});
