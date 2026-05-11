# Changelog

본 파일은 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 포맷을 따르고, 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 사용합니다. 카테고리 정의와 bump 기준은 [docs/release-policy.md](./docs/release-policy.md) 참고.

3 패키지(`@token-weather/cli` / `@token-weather/provider-adapters` / `@token-weather/schemas`)는 v0.x 동안 linked 되어 같은 version으로 release 됩니다.

## [Unreleased]

이 섹션은 publish 시점에 root에서 **수동으로 큐레이트**합니다 — 3 패키지를 가로지르는 사용자-가시 변경의 high-level 요약. 패키지별 상세 release note는 [Changesets](https://github.com/changesets/changesets)가 `packages/*/CHANGELOG.md`를 자동 생성하고, 본 문서는 publish PR에서 그 내용을 참고해 채웁니다. 사용자-가시 변경이 있는 PR은 `npx changeset` 으로 changeset을 함께 commit 해주세요.

## [0.3.0] - 2026-05-11

두 차례의 architectural symmetry 정비 release. claude / codex 의 fallback credential 흐름과 refresh helper 위치가 1:1 대칭으로 정렬되고, `status --json` 의 키 정합을 위한 `SCHEMA_VERSION` 두 단계 bump (`0.1.0` → `0.3.0`). 운영 측면에서는 `doctor --dedupe` 신규 진단 명령으로 누적 stale 레코드의 retroactive 정리 경로 확보.

### Changed (Breaking)

- **claude `~/.claude/stats-cache.json` 의존 제거** — `status --json` 의 `claude.usage` 필드 + per-session/per-message 누적 통계 출력 + public export (`readClaudeStatsCache`, `parseClaudeStatsCache`, `resolveClaudeUsageSource`, `resolveClaudeUsageSourcePath`) 모두 제거. 본 도구는 이제 network endpoint (`/api/oauth/usage`) 의 window 기반 사용률 (`five_hour` / `seven_day`) 만 노출 — Codex 의 server-side rate-limit 모델과 architectural symmetry ([#112]).
- **codex 폴백을 OpenClaw `auth-profiles.json` 에서 Codex CLI `~/.codex/auth.json` (`codex-cli-import`) 으로 교체** — claude 의 `claude-cli-import` 와 1:1 대칭. OpenClaw 환경 의존이 끊기고 npm 일반 사용자에게도 의미 있는 폴백이 제공됨 ([#114]).
- `status --json` 의 `authSource` enum: `'openclaw-import'` 제거 + `'codex-cli-import'` 추가 ([#114]).
- `status --json` 의 `codex.authProfilesPath` 필드 → `codex.credentialsPath` (claude 와 동일 표면, `~/.codex/auth.json` 경로) ([#114]).
- `@token-weather/provider-adapters` codex 영역의 public export 정비 — 제거: `readCodexAuthProfiles` / `getDefaultAuthProfilesPath`. 신규: `readCodexCliCredentials` / `resolveCodexCliCredentialsPath` / `parseCodexCliCredentials` / `mapCodexCredentials` / `buildImportedCodexAccount` / `resolveImportedCodexAccounts` / `selectCodexAccountsSource` / `resolveImportedCodexSnapshot` ([#114]).
- `SCHEMA_VERSION` `'0.1.0'` → `'0.3.0'` (두 단계 bump: `0.1.0` → `0.2.0` ([#112]), `0.2.0` → `0.3.0` ([#114])). `auth-store-schema.js::CREDENTIAL_SOURCES` enum 정합 — `'openclaw-import'` 제거 + 누락이던 `'claude-cli-import'` / `'codex-cli-import'` 명시 ([#114]).

**Migration**:

- `status --json` 의 `.providers[].snapshot.usage` 또는 `.providers[].snapshot.usage.source === 'stats-cache-json'` 분기 → 필드 부재. window 정보는 `.providers[].snapshot.networkUsage.usageWindows` 에서 그대로 수신.
- `.providers[].snapshot.authSource === 'openclaw-import'` 분기 → `'codex-cli-import'`.
- `.providers[].snapshot.codex.authProfilesPath` 참조 → `.credentialsPath`.
- OpenClaw 워크스페이스 사용자: 1회 `token-weather auth login codex` 실행 (또는 OpenClaw 측이 `~/.config/token-weather/auth.json` 에 직접 inject — OpenClaw repo 후속 작업 영역).
- `@token-weather/provider-adapters` 의 `readCodexAuthProfiles` 직접 import 한 consumer → `readCodexCliCredentials` + `buildImportedCodexAccount` 패턴으로 갱신.

### Added

- **`doctor codex/claude --dedupe` / `--apply` / `--backfill-account-id`** — 같은 OAuth subject (sub 또는 email) 의 stale 레코드를 dry-run 으로 감지하고 `--apply` 로 정리. login 시점 자동 정리(PR #38) 이전에 누적된 legacy accountKey 또는 id_token 파싱이 부분 실패한 레코드를 retroactive 로 청소 ([#108]).

### Fixed

- codex-cli-import fallback profile normalize 누락 수정 — `--account codex-cli-import` 필터 매칭 + `buildUsageSnapshot` 의 `snapshotId` / `account.profileId` 가 `codex:undefined:` 형태로 오염되던 회귀 차단. claude 의 `resolveClaudeProfileFromSnapshot` 과 1:1 대칭으로 `resolveCodexProfileFromAccount` 신설 (PR #114 review follow-up).

### Internal

- `refreshCodexToken` 을 dedicated `codex/refresh-codex-token.js` 로 분리 — `claude/refresh-claude-token.js` 와 위치 대칭. public API 변화 없음 (모든 소비자가 `codex/index.js` 통해 import) ([#111]).
- `docs/auth-cli.md` `doctor --dedupe` / `--apply` / `--backfill-account-id` 사용 예 + 안전 가이드 추가.
- `docs/cli-json-output.md` / `docs/architecture.md` / `docs/codebase-guide.md` / `docs/provider-notes.md` — stats-cache 제거 + codex-cli-import 전환 반영.

[Unreleased]: https://github.com/LLagoon3/token-weather/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/LLagoon3/token-weather/releases/tag/v0.3.0

[#108]: https://github.com/LLagoon3/token-weather/pull/108
[#111]: https://github.com/LLagoon3/token-weather/pull/111
[#112]: https://github.com/LLagoon3/token-weather/pull/112
[#114]: https://github.com/LLagoon3/token-weather/pull/114

## [0.2.0] - 2026-04-29

`auth login` default 동작을 실제 OAuth 토큰 교환으로 뒤집고 Codex/Claude 일관성 정렬 + observed `client_id` 가드 제거. publish 인프라 측면에서 첫 OIDC + Trusted Publishing + SLSA provenance 적용 release.

### Changed (Breaking)

- **`auth login` default 가 실제 OAuth 토큰 교환** — 이전 default 였던 mock 저장은 `--mock` opt-in 으로 이동 ([#98]).
- **`--live-exchange` flag 제거** — `--mock` 신설 (default 가 실제 OAuth 라 별도 flag 불필요) ([#98]).
- Codex / Claude `auth login` 옵션 표면 + 라우팅 + default 동작 모두 일관성 정렬 — `runCodexManualPasteFlow` 별도 함수 제거, 공통 `runManualPasteFlow` 통합, 두 spec 모두 `supportsMockCallback: true` + `saveMockAccount` 보유 ([#98]).
- `--mock` fail-closed 계약 — spec 미지원 시 실제 OAuth 로 fall-through 하지 않고 안내 후 종료 ([#98]).
- `@token-weather/provider-adapters` 의 `allowLiveExchange` 매개변수 + `liveExchangeDisabledError` 함수 + 관련 export 모두 제거 ([#98]).
- `auth list` 출력에서 `liveToken` 라인 제거 (`mock` 필드만 유지) ([#98]).
- GitHub repo 가 `LLagoon3/token-weather` 로 리네임되어 publish 메타 / 사용자 데이터 경로 / Anthropic API User-Agent 모두 정렬 ([#91]).

### Security

- **첫 OIDC + Trusted Publishing publish** — `NPM_TOKEN` secret 의존성 0, GitHub Actions OIDC token 만으로 publish 인증 ([#94], [#95]).
- **SLSA provenance v1 attestation 적용** — sigstore transparency log 등록, 외부에서 supply chain 검증 가능 ([#94]).

### Internal

- ESLint 9 flat config + Prettier 도입, root scripts (`lint`/`format`/`build`/`dev`) 실구현 ([#96]).
- release workflow Node 24 + 번들 npm 11+ — Trusted Publishing OIDC 요구사항 self-upgrade 없이 충족 ([#101]).
- install smoke (#75) + Trusted Publishing 운영 검증 흐름 정착 (release 격리/복원/token 제거 PR 시리즈 ([#92], [#93], [#94], [#95])).

[0.2.0]: https://github.com/LLagoon3/token-weather/releases/tag/v0.2.0

[#91]: https://github.com/LLagoon3/token-weather/pull/91
[#92]: https://github.com/LLagoon3/token-weather/pull/92
[#93]: https://github.com/LLagoon3/token-weather/pull/93
[#94]: https://github.com/LLagoon3/token-weather/pull/94
[#95]: https://github.com/LLagoon3/token-weather/pull/95
[#96]: https://github.com/LLagoon3/token-weather/pull/96
[#98]: https://github.com/LLagoon3/token-weather/pull/98
[#101]: https://github.com/LLagoon3/token-weather/pull/101

## [0.1.0] - 2026-04-27

첫 공개 publish 직전 상태 정리. v0.x 동안은 호환성 단순화를 위해 3 패키지를 linked로 유지합니다.

### Added

- Codex OAuth 로그인 / token exchange / live usage 조회 ([#6]).
- Claude CLI credential import 경로 ([#16]) 및 stats-cache usage + live OAuth ([#19]).
- multi-account 지원 — 병렬 조회, `--account` 필터, label + config default ([#43]).
- `@token-weather/schemas` runtime validation (`validateUsageSnapshot`) ([#47]).
- `doctor <provider> --refresh-live` 진단 경로 + token claims 기반 계정 식별 ([#6], [#43]).
- usage/status 조회 시 OAuth access token **자동 refresh** ([#57], [#58]).
- CLI 서브커맨드 단위 `--help` (status / usage / doctor / auth login·logout·list·import / config init) ([#66]).
- `status` / `usage` 의 `--provider <id>` scope 옵션 (case-insensitive 정규화 포함) ([#67]).
- `status` / `usage` 의 `--json` 출력 모드 — stable contract + token redaction ([#68]).
- Claude `--manual` paste 흐름 + `--live-exchange` 흐름 통합 ([#87]).
- 3 패키지 모두 TypeScript `.d.ts` 동봉 — `tsc --emitDeclarationOnly --allowJs` 기반 무빌드 emit ([#88]).

### Changed

- CLI option parser를 spec 기반 공통 helper(`parseCliOptions`)로 통일 — status / usage / doctor / auth login / auth logout ([#62]).
- Claude OAuth flow를 pi-ai baseline(`claude.ai` authorize endpoint + 6-scope) 기준으로 정렬 ([#87]).
- 패키지명을 `@token-weather/*`로 리네임, bin을 `token-weather`로 정렬 ([#82]).
- repo 식별자(`ai-usage-agent` → `token-weather`) 일괄 치환 + 워크스페이스 경계 import를 `@token-weather/*` 패키지명으로 변환 ([#82]).

### Fixed

- `--provider` 입력 case-insensitive 정규화 ([#67]).
- Claude 로그인 후 profile metadata 보강(누락된 account label 등) ([#55]).
- `parseCliOptions` 빈 문자열 value skip 보강 (legacy 계약 회귀 가드 포함) ([#62]).

### Security

- `status --json` 출력 token redaction (`SENSITIVE_KEYS` 확장 + case-insensitive 매칭) ([#68]).
- `SECURITY.md` / `CODE_OF_CONDUCT.md` 신설 + bug_report / PR template에 token redaction 체크 추가 ([#80]).
- Apache-2.0 LICENSE 적용 + 4개 package.json `license` 필드 정렬 ([#81]).

### Internal

- monorepo 구조: `packages/{agent,provider-adapters,schemas}` 분리 + provider registry + login/doctor runner ([#29], [#51]).
- account 선택 / auth source 선택 로직 공통화 ([#49]).
- 테스트 커버리지 보강 (Codex 대칭 / services / CLI / smoke) ([#32]).
- 회귀 가드 테스트: `repo-policy-{publish,license,readme,types}.test.js` + `import-discipline.test.js` ([#80], [#81], [#82], [#85], [#88]).
- CI: `npm install --no-package-lock` → `npm run build:types` → `npm test` 흐름 정착 ([#88]).
- README / CONTRIBUTING / `docs/codebase-guide.md` 사용자 온보딩 + 보안 신고 단락 + 라이선스 단락 ([#80], [#81], [#85]).

[0.1.0]: https://github.com/LLagoon3/token-weather/releases/tag/v0.1.0

[#6]: https://github.com/LLagoon3/token-weather/pull/6
[#16]: https://github.com/LLagoon3/token-weather/pull/16
[#19]: https://github.com/LLagoon3/token-weather/pull/19
[#29]: https://github.com/LLagoon3/token-weather/pull/29
[#32]: https://github.com/LLagoon3/token-weather/pull/32
[#43]: https://github.com/LLagoon3/token-weather/pull/43
[#47]: https://github.com/LLagoon3/token-weather/pull/47
[#49]: https://github.com/LLagoon3/token-weather/pull/49
[#51]: https://github.com/LLagoon3/token-weather/pull/51
[#55]: https://github.com/LLagoon3/token-weather/pull/55
[#57]: https://github.com/LLagoon3/token-weather/pull/57
[#58]: https://github.com/LLagoon3/token-weather/pull/58
[#62]: https://github.com/LLagoon3/token-weather/pull/62
[#66]: https://github.com/LLagoon3/token-weather/pull/66
[#67]: https://github.com/LLagoon3/token-weather/pull/67
[#68]: https://github.com/LLagoon3/token-weather/pull/68
[#80]: https://github.com/LLagoon3/token-weather/pull/80
[#81]: https://github.com/LLagoon3/token-weather/pull/81
[#82]: https://github.com/LLagoon3/token-weather/pull/82
[#85]: https://github.com/LLagoon3/token-weather/pull/85
[#87]: https://github.com/LLagoon3/token-weather/pull/87
[#88]: https://github.com/LLagoon3/token-weather/pull/88
