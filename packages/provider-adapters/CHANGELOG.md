# @token-weather/provider-adapters

## 0.4.0

### Minor Changes

- 01410bd: chore(agent)!: `status --json` 의 claude provider 영역에서 backward-compat alias 3 종 제거 (issue #119). `SCHEMA_VERSION` `'0.3.0'` → `'0.4.0'`. v0.x convention 상 breaking 도 minor + `!` prefix (release-policy §1 / §3).

  **Breaking changes**:
  - `.providers[].snapshot.networkUsage` (단일 객체) 제거 — `.providers[].snapshot.networkUsages[]` (배열) 만 유지.
  - `.providers[].snapshot.importedAccount` 제거 — `.providers[].snapshot.selectedAccount` 만 유지 (동일 값이었음).
  - `.providers[].snapshot.parsed` 제거 — `.providers[].snapshot.found` 만 유지 (항상 같은 값이었음).
  - `formatClaudeSection` (status-formatters / doctor-helpers) 의 legacy `networkUsage` (단일) fallback 코드 경로 제거 — 항상 `networkUsages[]` 배열만 처리.

  **Migration**:
  - `.providers[].snapshot.networkUsage` 참조 → `.providers[].snapshot.networkUsages[0].snapshot` (단일 계정) 또는 array 순회. **주의** — 이전 `networkUsage` 는 usage snapshot 객체 그대로였지만, 신규 `networkUsages[]` 의 각 원소는 `{ accountKey, account, snapshot }` wrapper. 실제 `usageWindows` / `status` 등 데이터는 `.snapshot` 안에 있어 `.snapshot` 단계 추가 필요. 자세한 예시는 `docs/cli-json-output.md` §"제거된 backward-compat alias (v0.4.0)".
  - `.providers[].snapshot.importedAccount` 참조 → `.providers[].snapshot.selectedAccount` 동일 의미.
  - `.providers[].snapshot.parsed` 참조 → `.providers[].snapshot.found` 동일 의미.

  `status --json` 외 평문 출력 / public API surface / runtime deps 무변경. 회귀 가드 — alias 키 부재 단언 신규 추가 (status-json.test.js / claude-provider.test.js / status-service.test.js).

- f4148ea: refactor(agent)!: `status --json` provider entry shape 정합 — codex / claude 키셋 동일화 (issue #120). `SCHEMA_VERSION` `'0.4.0'` → `'0.5.0'`. v0.x convention 상 breaking 도 minor + `!` prefix.

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

### Patch Changes

- 4be9bc1: feat(agent): `cli:status` 평문 출력에 `usedPercent` ASCII 막대 그래프 추가 + 컬러 임계값 (green<50 / yellow<80 / red≥80). `NO_COLOR` env / non-TTY / `TERM=dumb` 환경에서는 ANSI escape 없이 plain block char 만 렌더링 — `process.stdout.isTTY` + env 기반 자동 판별. `formatWindow` 의 `used_percent=N, reset_at=...` 텍스트가 `kind padEnd(12) + [████░░░░] + N%  reset_at=...` 한 줄 표기로 완전 대체된다. 함께 `status` / `usage` 평문 출력 전체 영어화 — 헤더 / 라벨 / 상태 / 에러 메시지 / `--help` 까지 (issue #116).

  `--json` 출력 / `SCHEMA_VERSION` / `usage-snapshot.schema.json` / `auth-store-schema.js` / public API (`packages/agent/src/index.js`) / d.ts surface 모두 무변경 — JSON contract 그대로 통과. `doctor` 명령 출력은 별도 path (`doctor-helpers.js`) 라 영향 없음.

  **Migration**: 외부 스크립트가 status 평문에서 `used_percent=N` substring 을 파싱하거나 `'명령:' / '상태:' / '플랜:' / '에러:' / '계정:' / '인증 소스:' / '비활성화됨' / '호출 안 함'` 같은 한글 라벨을 매칭하던 경우, 안정적인 contract 인 `status --json` 으로 옮기는 것을 권장. 평문은 release-policy §1 / `docs/cli-json-output.md` 가 stable contract 아님을 명시한다.

  신규 helper (`packages/agent/src/cli/status-bar-helper.js` — `shouldUseColor` / `levelForPercent` / `colorize` / `formatProgressBar`) 는 agent 패키지 CLI 내부이며 외부 export 면 변화 없음. runtime dep 0 정책 유지 (chalk / cli-progress 미도입, Unicode block char + raw ANSI escape 직접 출력).

- c648f24: docs(cli-json-output): contract 정합 보강 + top-level `schemaVersion` lock 회귀 가드 (issue #121).

  3-phase JSON contract 정리 plan 의 Phase 3 (Phase 1 #119 / Phase 2 #120 의 docs / 테스트 fall-through). public API / 출력 shape / SCHEMA_VERSION 모두 무변경 — patch bump.

  **Docs 보강** (`docs/cli-json-output.md`):
  - Top-level shape 표에 "부재 시" 컬럼 추가 (옵셔널 필드의 default 표기).
  - 신규 §"필드 부재 정책 — null vs 키 부재": 모든 정의 키는 항상 present, 값이 null 인지 확인하는 패턴 안내.
  - 신규 §"`authSource` enum 값": 4 값 (`agent-store` / `codex-cli-import` / `claude-cli-import` / `not-found`) 의미 + enum 변경의 SCHEMA_VERSION 트리거 명시.
  - 신규 §"`raw` 영역 책임 (provider adapter 계약)": SENSITIVE_KEYS 가 미치지 못하는 free-form subtree 의 위험 + provider adapter 3 책임 명시.

  **회귀 가드** (`packages/agent/test/cli/status-json.test.js`):
  - 신규 describe "formatStatusJson — top-level schemaVersion lock (issue #121)": `formatStatusJson` 통과 schemaVersion 이 `packages/schemas` 의 SCHEMA_VERSION 과 일치 단언 + key 항상 present 단언 + providerFilter / accountFilter / disabled provider 등 모든 출력 경로에서 schemaVersion 통과 단언.

  이 가드 덕에 SCHEMA_VERSION 변경이 한 곳만 bump 되는 회귀를 차단 — `packages/schemas/test/schema-version.test.js` (값 lock) 와 본 가드 (status --json 통과 경로 lock) 가 함께 동작.

- Updated dependencies [01410bd]
- Updated dependencies [4be9bc1]
- Updated dependencies [c648f24]
- Updated dependencies [f4148ea]
  - @token-weather/schemas@0.4.0

## 0.3.0

### Minor Changes

- d262117: refactor(adapters)!: codex 폴백을 OpenClaw `auth-profiles.json` 에서 Codex CLI 자체 `~/.codex/auth.json` (`codex-cli-import`) 으로 교체 — claude 의 `claude-cli-import` 와 1:1 architectural symmetry (issue #113). 본 도구가 OpenClaw 환경 의존을 끊어내고 npm 일반 사용자에게도 의미 있는 폴백을 제공.

  **Breaking changes** (release-policy §1 major 트리거이지만 v0.x convention 상 minor):
  - `status --json` 의 `authSource` enum: `'openclaw-import'` 제거 + `'codex-cli-import'` 추가
  - `status --json` 의 `codex.authProfilesPath` 필드 → `codex.credentialsPath` (claude 와 동일 표면, `~/.codex/auth.json` 경로)
  - public export 제거: `readCodexAuthProfiles` / `getDefaultAuthProfilesPath` (`@token-weather/provider-adapters` 의 codex 영역)
  - 신규 public export: `readCodexCliCredentials` / `resolveCodexCliCredentialsPath` / `parseCodexCliCredentials` / `mapCodexCredentials` / `buildImportedCodexAccount` / `resolveImportedCodexAccounts` / `selectCodexAccountsSource` / `resolveImportedCodexSnapshot`
  - `SCHEMA_VERSION`: `'0.2.0'` → `'0.3.0'`
  - `auth-store-schema.js::CREDENTIAL_SOURCES` enum 정합 (incomplete 였던 enum 도 `'claude-cli-import'` / `'codex-cli-import'` 명시)

  **Migration**:
  - `status --json` 의 `.providers[].snapshot.authSource === 'openclaw-import'` 분기 → `'codex-cli-import'` 로 갱신
  - `.providers[].snapshot.codex.authProfilesPath` 참조 → `.credentialsPath`
  - OpenClaw 워크스페이스 사용자: 1회 `token-weather auth login codex` 실행 (또는 OpenClaw 측에서 `~/.config/token-weather/auth.json` 에 직접 inject 하도록 변경 — OpenClaw repo 후속 작업 영역)
  - `@token-weather/provider-adapters` 의 `readCodexAuthProfiles` 직접 import 한 consumer → `readCodexCliCredentials` + `buildImportedCodexAccount` 패턴으로 갱신

- 01ef74c: feat(cli): `doctor codex/claude --dedupe` / `--apply` / `--backfill-account-id` 옵션 추가 — 같은 OAuth subject (sub 또는 email) 의 stale 레코드를 dry-run 으로 감지하고 `--apply` 로 정리. login 시점 자동 정리(PR #38) 이전에 누적된 legacy accountKey 또는 id_token 파싱이 부분 실패한 레코드를 retroactive 로 청소 (issue #37). 자세한 사용법은 [docs/auth-cli.md §doctor `--dedupe`](docs/auth-cli.md).
- 03cf249: refactor(adapters)!: claude `~/.claude/stats-cache.json` 의존 제거 — `status --json` 의 `claude.usage` 필드 + per-session/per-message 누적 통계 출력 + public export (`readClaudeStatsCache`, `parseClaudeStatsCache`, `resolveClaudeUsageSource`, `resolveClaudeUsageSourcePath`) 제거. 본 도구는 이제 network endpoint (`/api/oauth/usage`) 의 window 기반 사용률 정보 (five_hour / seven_day) 만 노출한다 — Codex 의 server-side rate-limit 모델과 architectural symmetry. v0.x convention 상 breaking 도 minor 로 bump (release-policy §1 의 major 트리거지만 v0.x).

  **Migration**: `status --json` 결과에서 `.providers[].snapshot.usage` 또는 `.providers[].snapshot.usage.source === 'stats-cache-json'` 분기를 사용하던 consumer 는 필드 부재로 갱신 필요. window 정보는 `.providers[].snapshot.networkUsage.usageWindows` 에서 그대로 받을 수 있다. 누적 통계가 필요하면 `~/.claude/stats-cache.json` 을 직접 파싱 — Anthropic 의 client-side artifact 라 본 도구가 추상화하지 않는다.

  (issue #110)

### Patch Changes

- 92f6d9d: refactor(adapters): `refreshCodexToken` 을 dedicated `codex/refresh-codex-token.js` 로 분리. 기존엔 `codex/exchange-codex-authorization-code.js` 안에 inline 으로 있어 `claude/refresh-claude-token.js` 와 위치 비대칭이었음. public API 변화 없음 — 모든 소비자가 `@token-weather/provider-adapters/src/codex/index.js` 를 통해 import 하므로 호출 사이트 변경 0. 두 provider 가 `refresh-*-token.js` 의 동일한 파일 구조로 정렬되어 미래 provider 추가 시 패턴 따라가기 쉬워진다 (issue #105 의 일부).
- Updated dependencies [d262117]
- Updated dependencies [01ef74c]
- Updated dependencies [92f6d9d]
- Updated dependencies [03cf249]
  - @token-weather/schemas@0.3.0

## 0.2.0

### Minor Changes

- 7ec3111: `auth login` default 가 실제 OAuth 토큰 교환으로 변경되었습니다 (이전 default 는 mock 저장).

  Breaking changes:
  - `--live-exchange` flag 제거 → `--mock` flag 신설 (default = 실제 OAuth)
  - Codex / Claude 의 옵션 표면 + 라우팅 + default 동작 모두 일관성 정렬
    - `runCodexManualPasteFlow` 별도 함수 제거 → 공통 `runManualPasteFlow` 로 통합
    - 두 provider 모두 `supportsMockCallback: true` + `saveMockAccount` 보유
  - `@token-weather/provider-adapters` 의 `allowLiveExchange` 매개변수 + `liveExchangeDisabledError` 함수 + 관련 export 모두 제거
  - `auth list` 출력에서 `liveToken` 라인 제거 (mock 필드만 유지)

  자세한 흐름은 [docs/auth-cli.md](https://github.com/LLagoon3/token-weather/blob/main/docs/auth-cli.md) 참고.

### Patch Changes

- Updated dependencies [7ec3111]
  - @token-weather/schemas@0.2.0
