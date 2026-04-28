# Release 정책 (semver / CHANGELOG / SCHEMA_VERSION)

본 문서는 `@token-weather/cli` / `@token-weather/provider-adapters` / `@token-weather/schemas` 세 패키지의 version bump 기준과 CHANGELOG 운영 규약을 정리한다. PR 리뷰 시 인용 가능한 형태로 유지.

도구: [Changesets](https://github.com/changesets/changesets) — `.changeset/*.md` 파일 누적 → release PR 자동 생성. 셋업 / 기여자 절차는 [.changeset/README.md](../.changeset/README.md) 참고.

## 1. semver 트리거

세 패키지는 **linked** 상태라 같은 bump를 받는다 (v0.x 동안 호환성 단순화 우선).

### major (X.0.0)

사용자가 install 후 코드를 고쳐야 동작이 유지되는 변경:

- `status --json` 출력 shape 변경 — 키 제거, 의미 변경, 중첩 구조 재구성. 신규 키 추가는 minor.
- `packages/schemas` JSON Schema의 키 제거 / 의미 변경 / shape 재구성.
- `SCHEMA_VERSION` bump (별도 §3 참고).
- public d.ts breaking — export 제거, 함수 signature 변경(필수 param 추가/순서 변경/타입 narrow), `@typedef` 키 제거.
- CLI flag 제거 또는 shorthand 의미 변경 (예: `--account` 동작 자체가 바뀜).
- 기존 CLI 명령 제거 (예: `token-weather status` 자체를 없앰).
- `~/.config/token-weather/` 경로 / `auth.json` 스키마의 incompatible 변경.

### minor (0.X.0)

기존 사용자 코드가 동작하면서 기능이 추가되는 변경:

- 신규 CLI flag (예: `--json`, `--provider`) 추가.
- 신규 provider 추가 (예: `auth login gemini`).
- `packages/schemas`에 신규 optional 키 추가.
- public d.ts에 신규 export 추가, 또는 기존 export의 typedef에 optional 필드 추가.
- 신규 서브커맨드 (예: `token-weather inspect`) 추가.

### patch (0.0.X)

내부 변경 또는 사용자가 인지할 필요 없는 수정:

- 버그 수정 (출력 포맷 오류, 잘못된 redaction 등).
- 내부 리팩터 (export 면 변화 없음).
- observed 값 갱신 (예: `client_id`, endpoint URL이 외부 변경에 따라 보정).
- JSDoc 보강으로 d.ts 정확도 개선 (`any` → 구체적 타입). 기존 호환되는 타입 → 더 구체적인 타입은 patch (사용자가 코드를 고칠 필요 없음).
- 의존성 보안 업데이트.
- docs / 테스트 / CI 변경.

## 2. 도메인별 자세한 기준

### `status --json` 출력

contract는 [docs/cli-json-output.md](./cli-json-output.md)에 stable로 명시되어 있다.

- 키 추가: minor
- 키 제거 / 의미 변경: major
- redaction list(`SENSITIVE_KEYS`) 확장: patch (기존 출력에서 토큰만 더 빠지는 방향이라 비파괴적). 단 사용자가 그 키를 의도적으로 사용하고 있었다면 major로 격상 검토.

### CLI flag

- 신규 flag: minor
- flag 제거: major
- flag 동작 의미 변경 (예: `--account` case 처리 변경): major
- flag 기본값 변경: 사용자에게 visible behavior 차이가 있으면 major, 그 외 minor

### Provider adapter

- 신규 provider: minor
- 기존 provider의 endpoint / scope 변경: 사용자에게 invalid_grant 같은 회귀 위험이 있으면 major. observed 보정만으로 끝나고 사용자 영향 없으면 patch (예: PR #87의 pi-ai parity는 invalid_grant 의심을 줄이는 보정이라 minor 정도가 합리적).

### d.ts (TypeScript 타입)

기준: PR #88로 도입된 d.ts emission. JSDoc 커버리지에 의존하므로 정확도가 점진적으로 개선되는 영역.

- 신규 export 노출: minor
- export 제거 / signature breaking: major
- 기존 `any`를 구체적 타입으로 narrow (사용자가 코드 변경 없이 컴파일됨): patch
- `@typedef` 필드 추가 (optional): minor
- `@typedef` 필드 제거 / 필수화: major

### 보안 redaction

- `SENSITIVE_KEYS` 확장: patch (기본적으로 토큰이 덜 노출되는 방향). consumer의 정상 사용에 영향 없음.
- `redactSensitive` 동작 자체 변경 (어떤 키를 더 노출하는 방향): major. 단 그런 변경은 보안상 명시적 결정이 필요.

## 3. SCHEMA_VERSION 규약

`packages/schemas/src/index.js::SCHEMA_VERSION`은 현재 `'0.1.0'` (string semver).

- 본 패키지의 `version`과는 **독립**. 패키지가 0.5.0이어도 SCHEMA_VERSION은 0.1.0일 수 있음.
- bump 트리거: §1의 **major** 항목 중 `status --json` shape 또는 `packages/schemas` JSON Schema의 breaking 변경이 발생할 때.
- format: string semver (`'0.1.0'`, `'1.0.0'`). 정수가 아닌 이유는 sub-bump(예: `0.1.1`로 backward-compat schema 보강) 가능성.
- v1.0.0 이전(현재): 사용자에게 미공개 상태로 자유롭게 변경. v1.0.0 publish 이후: 위 규약 엄격 적용.

## 4. CHANGELOG 운영

CHANGELOG는 두 layer로 운영한다 — Changesets 기본 동작에 맞춰서.

- **`packages/<name>/CHANGELOG.md`** (auto): `changesets/action`의 `version` step이 누적된 changeset을 소비해 각 publishable package에 자동 생성/갱신. PR 본문 + bump type이 그대로 반영된다.
- **루트 [CHANGELOG.md](../CHANGELOG.md)** (manual curated): 3 패키지를 가로지르는 사용자-가시 변경의 high-level 요약. publish 시점에 release PR 작성자가 per-package CHANGELOG들을 참고해 수동으로 채운다. 카테고리 정의는 아래.

루트 CHANGELOG 카테고리:

- **Added** — 신규 export / flag / provider / 명령
- **Changed** — 기존 동작의 visible behavior 변경 (semver의 minor/major 트리거가 됨)
- **Deprecated** — 다음 major에서 제거 예정 표기
- **Removed** — 이번 release에서 제거된 항목 (major)
- **Fixed** — 버그 수정
- **Security** — 보안 관련 변경 (redaction list 확장 / token 처리 보강 등)
- **Internal** — 사용자에게 노출 안 되는 리팩터 / 테스트 / CI / 의존성. 이 카테고리는 **사용자 가독성 우선**으로 자동 생성된 minor 변경 위주이고, 큰 인프라 변경은 별도 entry로 두기.

각 항목은 PR 번호 링크 + 한 줄 설명. 자세한 맥락은 PR description / per-package CHANGELOG로 위임.

> **참고**: 향후 root CHANGELOG도 자동 집계가 필요해지면 `@changesets/changelog-github` 같은 custom changelog formatter + post-version 스크립트로 root에 모으는 step을 추가하는 방향으로 확장한다. 본 PR(#74) 시점에는 manual 운영.

## 5. release PR 흐름

1. PR 작성자가 `npx changeset` 실행 → `.changeset/<name>.md` 생성 + commit.
2. PR이 dev로 머지되면 `changesets/action`이 누적된 changeset을 모아 release PR(`packages/*/package.json` version bump + `packages/*/CHANGELOG.md` 갱신)을 자동 생성/갱신.
3. release PR을 검토하면서 root [CHANGELOG.md](../CHANGELOG.md)의 `[Unreleased]` 섹션을 per-package 변경 요약 기준으로 **수동** 갱신 후 머지.
4. release PR 머지 시 `release.yml`이 `bash ./scripts/install-smoke.sh` 안전벨트(#75)를 한 번 더 실행하고, `changesets/action`의 publish step이 `npx changeset publish`로 npm registry에 자동 출판한다. 3 publishable 패키지(`@token-weather/cli` / `@token-weather/provider-adapters` / `@token-weather/schemas`)가 동일 version으로 출판된다(linked).
5. publish 결과는 `changesets/action`이 GitHub Release 자동 생성 — release note는 per-package CHANGELOG 기반. v1.0.0 이상에서는 dev → main 머지가 release tag와 연결.

## 6. 변경 이력

- 2026-04-27 (#74): 초안 작성. v0.1.0 publish 직전 상태에서 정책 명문화.
- 2026-04-28 (#74 review follow-up): root CHANGELOG는 수동 큐레이트, per-package CHANGELOG는 Changesets 자동 생성으로 layer 구분 명문화.
- 2026-04-28 (#76): publish step 활성화 — `release.yml`에 `npx changeset publish` + `NPM_TOKEN` 연결 + install smoke (#75) 안전벨트 재호출. release PR 머지 시 자동 npm publish.
- 2026-04-28 (#76 + #77 통합): npm publish provenance 활성화 — `release.yml` job 에 `id-token: write` 권한 + changesets/action env 에 `NPM_CONFIG_PROVENANCE: 'true'` 추가. 첫 publish 부터 supply chain attestation 적용. (#77 별도 이슈는 본 PR 로 흡수 close.)
- 2026-04-28 (provenance 일시 격리): 위 통합 머지 후 release workflow 가 `PUT 404` 로 first publish 에 실패. 로컬 dry-run(`--provenance=false`) 은 정상 통과해 차이가 GitHub Actions provenance/OIDC 경로로 좁혀짐 — npm.com 에 Trusted Publisher 등록 안 된 상태에서 OIDC publish 가 거부되는 케이스. 일시 격리: `id-token: write` 제거 + `NPM_CONFIG_PROVENANCE: 'false'` + `setup-node` 에 `scope: '@token-weather'` + `Verify npm auth` 진단 step 추가. 첫 publish 성공 후 후속 PR(#77 재도입)에서 npm.com Trusted Publisher 등록 + provenance 재활성화 예정.
- 2026-04-28 (#77 재도입): Trusted Publisher 등록 완료 — npm.com 의 3 패키지(`@token-weather/{cli,provider-adapters,schemas}`) 각각에 GitHub Actions provider(repo `LLagoon3/token-weather`, workflow `release.yml`) 추가. `release.yml` 에 `id-token: write` 복원 + `NPM_CONFIG_PROVENANCE: 'true'` 복원 + 회귀 가드 2건 다시 추가. v0.1.0 (첫 publish) 은 attestation 없이 출판됐고, 다음 release publish 부터 supply chain attestation 적용. `NPM_TOKEN` 은 fallback 으로 유지 (별도 후속 PR 에서 token 의존성 완전 제거 검토 가능).
- 2026-04-28 (NPM_TOKEN 제거): Trusted Publishing(OIDC) 단독 운영으로 전환. `release.yml` 에서 `NPM_TOKEN` / `NODE_AUTH_TOKEN` env 와 'Verify npm auth' 진단 step 모두 제거 — `npm whoami` 는 token-based auth 의존이라 OIDC 환경에서 의미 없음. 회귀 가드는 token env 부재 단언으로 뒤집기. GitHub repo 의 `NPM_TOKEN` secret 도 별도 사용자 액션으로 삭제 — long-lived secret 관리 부담 해소. 다음 v0.1.1 publish 가 OIDC 단독으로 정상 동작 + provenance 적용 시 보안 모델 전환 완료.
- 2026-04-28 (#97 v0.2.0): `auth login` default 를 실제 OAuth 로 뒤집기 + Codex/Claude 일관성 정렬 + observed `client_id` 가드 제거. breaking change — `--live-exchange` flag 제거 → `--mock` 신설. 라이브러리 (`@token-weather/provider-adapters`) 의 `allowLiveExchange` 매개변수 + `liveExchangeDisabledError` 함수 + 관련 export 모두 삭제. 본 PR 의 changeset 머지가 첫 OIDC 단독 publish (v0.2.0) 트리거.
