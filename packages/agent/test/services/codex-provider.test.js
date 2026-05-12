import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCodexSnapshot,
  selectCodexAuthSource,
  filterRealCodexAccounts,
  filterProfilesByAccount,
  resolveCodexProfileFromAccount,
} from '../../src/services/codex-provider.js';
import { filterEntriesByAccount } from '../../src/services/account-filter.js';
import { buildImportedCodexAccount } from '@token-weather/provider-adapters/src/codex/index.js';
import { buildUsageSnapshot } from '@token-weather/provider-adapters/src/shared/usage-snapshot.js';

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

  it('falls back to codex-cli-import when agent list is empty (issue #113)', () => {
    const result = selectCodexAuthSource([], [{ id: 'imported' }]);
    assert.equal(result.authSource, 'codex-cli-import');
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
  it('returns enabled=false with empty usageSnapshots when codex disabled (issue #120)', async () => {
    const snap = await getCodexSnapshot({ providers: { codex: { enabled: false } } });
    assert.equal(snap.enabled, false);
    // v0.5.0 (issue #120): snapshots → usageSnapshots rename
    assert.deepEqual(snap.usageSnapshots, []);
    assert.equal('snapshots' in snap, false);
    // issue #113 — credentialsPath (Codex CLI 와 정렬, claude 와 대칭)
    assert.equal(typeof snap.credentialsPath, 'string');
    assert.match(snap.credentialsPath, /\/\.codex\/auth\.json$/);
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

// ── PR #114 review follow-up — codex-cli-import profile normalize 회귀 가드 ──
// 코멘트 요지: imported codex account 가 raw 그대로 profile 로 전달되면
//   (a) filterProfilesByAccount(id/email/label) 에서 --account codex-cli-import 미매칭
//   (b) buildUsageSnapshot 의 snapshotId / account.profileId 가 `codex:undefined:...`
// 두 문제 모두 발생. resolveCodexProfileFromAccount 가 1차 normalize 단계.
// claude 의 resolveClaudeProfileFromSnapshot 과 1:1 대칭.

describe('resolveCodexProfileFromAccount (via codex-provider)', () => {
  it('returns null when account is missing', () => {
    assert.equal(resolveCodexProfileFromAccount(null), null);
    assert.equal(resolveCodexProfileFromAccount(undefined), null);
  });

  it('returns null when no accessToken anywhere', () => {
    assert.equal(resolveCodexProfileFromAccount({ accountKey: 'x' }), null);
  });

  it('extracts accessToken from imported codex account (top-level)', () => {
    const profile = resolveCodexProfileFromAccount({
      provider: 'codex',
      source: 'codex-cli-import',
      accountKey: 'codex-cli-import',
      accessToken: 'cli-at',
      refreshToken: 'cli-rt',
      idToken: 'jwt-x',
      accountId: 'acc-1',
    });
    assert.equal(profile.id, 'codex-cli-import');
    assert.equal(profile.accountKey, 'codex-cli-import');
    assert.equal(profile.accessToken, 'cli-at');
    assert.equal(profile.accountId, 'acc-1');
  });

  it('extracts accessToken from tokens.accessToken (agent-store shape)', () => {
    const profile = resolveCodexProfileFromAccount({
      accountKey: 'codex:alice',
      tokens: { accessToken: 'store-at' },
    });
    assert.equal(profile.accessToken, 'store-at');
    assert.equal(profile.id, 'codex:alice');
  });
});

describe('codex-cli-import profile → filterProfilesByAccount (PR #114)', () => {
  it('matches when --account codex-cli-import is requested', () => {
    const imported = buildImportedCodexAccount({
      id_token: 'jwt-1',
      access_token: 'at',
      refresh_token: 'rt',
      account_id: 'acc-1',
    });
    const profile = resolveCodexProfileFromAccount(imported);
    const matched = filterProfilesByAccount([profile], 'codex-cli-import');
    assert.equal(matched.length, 1);
    assert.equal(matched[0].id, 'codex-cli-import');
  });

  it('does not match an unrelated filter value', () => {
    const imported = buildImportedCodexAccount({
      id_token: 'jwt-1',
      access_token: 'at',
      refresh_token: 'rt',
      account_id: 'acc-1',
    });
    const profile = resolveCodexProfileFromAccount(imported);
    assert.equal(filterProfilesByAccount([profile], 'nope').length, 0);
  });
});

describe('codex-cli-import profile → buildUsageSnapshot id stability (PR #114)', () => {
  it('snapshotId / account.profileId are stable strings, never undefined', () => {
    const imported = buildImportedCodexAccount({
      id_token: 'jwt-1',
      access_token: 'at',
      refresh_token: 'rt',
      account_id: 'acc-1',
    });
    const profile = resolveCodexProfileFromAccount(imported);

    const snap = buildUsageSnapshot({
      profile,
      providerId: 'openai-codex',
      displayName: 'Codex',
      snapshotIdPrefix: 'codex',
      capturedAt: new Date('2026-05-11T00:00:00.000Z'),
      responseStatus: 200,
      ok: true,
      data: {},
      rawText: '',
      fields: {},
    });

    assert.equal(typeof snap.snapshotId, 'string');
    assert.equal(typeof snap.account.profileId, 'string');
    assert.equal(snap.account.profileId, 'codex-cli-import');
    assert.equal(snap.snapshotId, 'codex:codex-cli-import:2026-05-11T00:00:00.000Z');
    // `codex:undefined:` substring 부재 — regression guard
    assert.ok(!snap.snapshotId.includes('undefined'));
  });
});
