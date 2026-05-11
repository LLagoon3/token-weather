# @token-weather/provider-adapters

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
