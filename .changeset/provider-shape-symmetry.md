---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
---

refactor(agent)!: `status --json` provider entry shape 정합 — codex / claude 키셋 동일화 (issue #120). `SCHEMA_VERSION` `'0.4.0'` → `'0.5.0'`. v0.x convention 상 breaking 도 minor + `!` prefix.

**Breaking changes** (release-policy §1 의 키 제거 + 의미 변경 = major 트리거):

- codex `.providers[].snapshot.snapshots[]` 키 → `.usageSnapshots[]` 로 rename.
- claude `.providers[].snapshot.networkUsages[]` 키 → `.usageSnapshots[]` 로 rename.
- claude `usageSnapshots[]` 원소 shape 정합 — 이전 `{ accountKey, account, snapshot }` wrapper 제거, **UsageSnapshot 객체 직접** 배열로 (codex 와 동일). `.snapshot.usageWindows` → `.usageWindows` 한 단계 짧아짐.
- claude `.providers[].snapshot.detected` / `.found` 제거 → 단일 `.enabled` boolean 으로 통합 (codex 와 동일 키).
- claude `.providers[].snapshot.selectedAccount` 제거 — default account 개념이 multi-account + 박스 UI 도입 후 의미가 약해져 양 provider 모두 미노출. 필요시 `.usageSnapshots[]` 순회로 식별.
- claude `.providers[].snapshot.credentialsPath` 정책 정합 — 이전엔 항상 path 노출이었으나 v0.5.0 부터 `cli-import` 인증 소스 시점에만 path, 그 외엔 `null` (codex 와 동일 정책).

**Migration**:

```js
// before (v0.4.x)
const codexEnabled = providers.find((p) => p.id === 'codex').snapshot.enabled;
const codexSnaps = providers.find((p) => p.id === 'codex').snapshot.snapshots;
const claudeEnabled = providers.find((p) => p.id === 'claude').snapshot.detected;
const claudeFound = providers.find((p) => p.id === 'claude').snapshot.found;
const claudeWindows = providers.find((p) => p.id === 'claude').snapshot.networkUsages[0].snapshot
  .usageWindows;
const claudeAccount = providers.find((p) => p.id === 'claude').snapshot.selectedAccount;

// after (v0.5.0+) — codex / claude 동일 path
const provider = (id) => providers.find((p) => p.id === id).snapshot;
const codexEnabled = provider('codex').enabled;
const codexSnaps = provider('codex').usageSnapshots;
const claudeEnabled = provider('claude').enabled;
const claudeWindows = provider('claude').usageSnapshots[0].usageWindows; // wrapper 제거됨
const claudeAccount = provider('claude').usageSnapshots.find(/* ... */)?.account;
```

자세한 표 + 예시는 [`docs/cli-json-output.md`](docs/cli-json-output.md) §"Provider shape symmetry (v0.5.0)".

**무영향**: 평문 출력 (`status` / `usage`) 사용자 가시 동일성 유지 — 내부 키 rename 만, 시각 표현 무변경. public API surface (workspace package 의 export) 무변경. runtime deps 무변경.

회귀 가드 신설: `status-json.test.js` 에 codex / claude provider snapshot keyset 동일성 + legacy 키 부재 단언 (snapshots / networkUsages / networkUsage / detected / found / parsed / selectedAccount / importedAccount).
