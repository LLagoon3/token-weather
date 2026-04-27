# Changelog

본 파일은 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 포맷을 따르고, 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 사용합니다. 카테고리 정의와 bump 기준은 [docs/release-policy.md](./docs/release-policy.md) 참고.

3 패키지(`@token-weather/cli` / `@token-weather/provider-adapters` / `@token-weather/schemas`)는 v0.x 동안 linked 되어 같은 version으로 release 됩니다.

## [Unreleased]

이 섹션은 publish 시점에 root에서 **수동으로 큐레이트**합니다 — 3 패키지를 가로지르는 사용자-가시 변경의 high-level 요약. 패키지별 상세 release note는 [Changesets](https://github.com/changesets/changesets)가 `packages/*/CHANGELOG.md`를 자동 생성하고, 본 문서는 publish PR에서 그 내용을 참고해 채웁니다. 사용자-가시 변경이 있는 PR은 `npx changeset` 으로 changeset을 함께 commit 해주세요.

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

- CLI option parser를 spec 기반 공통 helper(`parseCliOptions`)로 통일 — status / usage / doctor / login / logout / refresh ([#62]).
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

[Unreleased]: https://github.com/LLagoon3/ai-usage-agent/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/LLagoon3/ai-usage-agent/releases/tag/v0.1.0

[#6]: https://github.com/LLagoon3/ai-usage-agent/pull/6
[#16]: https://github.com/LLagoon3/ai-usage-agent/pull/16
[#19]: https://github.com/LLagoon3/ai-usage-agent/pull/19
[#29]: https://github.com/LLagoon3/ai-usage-agent/pull/29
[#32]: https://github.com/LLagoon3/ai-usage-agent/pull/32
[#43]: https://github.com/LLagoon3/ai-usage-agent/pull/43
[#47]: https://github.com/LLagoon3/ai-usage-agent/pull/47
[#49]: https://github.com/LLagoon3/ai-usage-agent/pull/49
[#51]: https://github.com/LLagoon3/ai-usage-agent/pull/51
[#55]: https://github.com/LLagoon3/ai-usage-agent/pull/55
[#57]: https://github.com/LLagoon3/ai-usage-agent/pull/57
[#58]: https://github.com/LLagoon3/ai-usage-agent/pull/58
[#62]: https://github.com/LLagoon3/ai-usage-agent/pull/62
[#66]: https://github.com/LLagoon3/ai-usage-agent/pull/66
[#67]: https://github.com/LLagoon3/ai-usage-agent/pull/67
[#68]: https://github.com/LLagoon3/ai-usage-agent/pull/68
[#80]: https://github.com/LLagoon3/ai-usage-agent/pull/80
[#81]: https://github.com/LLagoon3/ai-usage-agent/pull/81
[#82]: https://github.com/LLagoon3/ai-usage-agent/pull/82
[#85]: https://github.com/LLagoon3/ai-usage-agent/pull/85
[#87]: https://github.com/LLagoon3/ai-usage-agent/pull/87
[#88]: https://github.com/LLagoon3/ai-usage-agent/pull/88
