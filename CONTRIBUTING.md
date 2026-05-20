# 기여 / 작업 규칙

이 저장소는 `Portfolio-Project`에서 사용 중인 커밋/PR 흐름을 참고해 운영한다.

## 1. 브랜치 전략

기본 브랜치는 다음처럼 사용한다.

- `main`: 마지막 publish 된 commit 의 자동 동기 mirror — npm latest 와 정합. release.yml 의 FF sync step 이 publish 직후 자동 갱신하므로 사람이 직접 PR/push 하지 않는다.
- `dev`: 통합 trunk — 모든 feature PR 의 base, release PR 도 dev 로 머지되며 publish 트리거.
- 작업 브랜치: 기능/수정 단위 브랜치 — `dev` 에서 cut.

권장 흐름:

1. `dev` 에서 작업 브랜치를 만든다.
2. 작업이 끝나면 `dev` 로 PR 을 연다.
3. release 시점에는 `changesets/action` 이 누적된 changeset 으로 release PR (`changeset-release/dev`) 을 자동 생성/갱신한다.
4. release PR 을 `dev` 로 머지하면 publish + GitHub Release tag 자동 실행, 직후 main 이 dev tip 으로 자동 FF 동기화된다.

상세 흐름은 [docs/release-policy.md §5](./docs/release-policy.md).

브랜치 이름 예시:

- `feat/codex-adapter`
- `feat/claude-adapter`
- `fix/schema-normalizer`
- `chore/repo-scaffold`
- `docs/provider-notes-ko`

## 2. 커밋 메시지 규칙

기본 형식:

```text
<type>(<scope>): <한글 설명>
```

scope가 애매하면 생략 가능:

```text
<type>: <한글 설명>
```

### type 목록

- `feat`: 기능 추가
- `fix`: 버그 수정
- `refactor`: 동작 변화 없는 구조 개선
- `docs`: 문서 수정
- `chore`: 설정, 스캐폴드, 기타 유지보수
- `ci`: CI/CD 변경
- `test`: 테스트 추가/수정
- `perf`: 성능 개선

### scope 예시

- `agent`
- `schemas`
- `adapters`
- `codex`
- `claude`
- `repo`
- `docs`

### 좋은 예시

- `feat(codex): usage endpoint 응답을 공통 snapshot으로 변환`
- `fix(agent): status 명령 출력 포맷 오류 수정`
- `docs(repo): 브랜치 전략과 PR 규칙 추가`
- `ci(schemas): schema 검사 잡 추가`

### 피할 것

- `update`
- `fix bug`
- `작업중`
- `커밋`
- 의미 없는 여러 변경을 한 커밋에 몰아넣기

## 3. Pull Request 규칙

### PR 제목

기본 형식:

```text
[type] 한글 요약
```

예시:

- `[feat] Codex usage adapter 초안 추가`
- `[fix] usage snapshot 정렬 오류 수정`
- `[docs] schema 예시 payload 문서화`

### PR 본문

설명은 기본적으로 한글로 작성한다.
외부 라이브러리명, API명, 경로, 코드 식별자는 원문 그대로 적어도 된다.

PR 본문에는 최소한 아래 내용을 포함한다.

1. 요약
2. 변경 내용
3. 변경 이유
4. 영향 범위
5. 테스트 / 확인
6. 리뷰 포인트
7. 참고 사항

### 영향 범위 체크 예시

- [ ] `packages/schemas`
- [ ] `packages/provider-adapters`
- [ ] `repo`
- [ ] `docs`

## 4. 작업 단위 규칙

- 하나의 PR은 가능한 한 하나의 주제만 다룬다.
- 스캐폴드/문서/기능/리팩터링을 한 PR에 과하게 섞지 않는다.
- 기능 PR이면 가능한 한 mock 또는 sample payload 기준으로라도 확인 결과를 남긴다.
- provider endpoint 검증 코드는 `scripts/poc/`에서 시작하고, 안정화되면 package 내부로 옮긴다.

## 5. 병합 전 확인

최소 확인 항목:

- 관련 문서가 필요하면 같이 수정했는가
- schema 변경이면 sample payload도 같이 반영했는가
- CLI 출력 변경이면 실행 결과 또는 설명이 있는가
- endpoint/auth 관련 변경이면 인증/보안 영향이 정리됐는가

## 6. 이 저장소의 기본 원칙

- 커밋 타입은 영어로 유지
- 설명은 한글 기준
- PR 본문도 한글 기준
- `dev` 가 통합 trunk — feature PR base + publish trigger
- `main` 은 publish 후 자동 FF 되는 mirror — npm latest 와 정합 (직접 PR/push 안 함)

## 7. 행동 강령 / 보안

- 모든 기여자는 [Code of Conduct](./CODE_OF_CONDUCT.md)를 준수한다.
- 보안 이슈(토큰 유출, 자격증명 처리 결함 등)는 GitHub Issue에 직접 작성하지 말고 [SECURITY.md](./SECURITY.md)에 안내된 비공개 신고 채널을 사용한다.
- PR / issue 본문에 access token / refresh token / id token / session cookie / accountKey 같은 민감값을 절대 첨부하지 않는다. 실수로 노출한 경우 즉시 revoke 후 재발급한다(절차는 SECURITY.md).
- 새로운 토큰성 필드를 provider adapter / auth schema에 도입하는 PR은 동일 PR 안에서 `packages/agent/src/cli/status-json.js::SENSITIVE_KEYS`를 갱신하고 redaction 회귀 테스트를 추가한다 (`docs/cli-json-output.md` §한계 참고).

## 8. Release / changeset

사용자-가시 변경(public API / CLI / `--json` shape / d.ts 등)을 포함하는 PR은 [Changesets](https://github.com/changesets/changesets)로 release note를 함께 commit한다.

```bash
npx changeset
```

대화형 프롬프트가 (1) 영향받는 패키지 (3개 publishable이 linked되어 있어 셋이 같은 bump를 받음) (2) bump type (major / minor / patch) (3) 사용자 노출 변경 한 줄 요약을 묻는다. 생성된 `.changeset/<random-name>.md`를 PR에 함께 commit하면 dev 머지 시 `changesets/action`이 누적된 changeset을 모아 release PR을 자동 생성/갱신한다 — 이때 `packages/<name>/CHANGELOG.md`가 자동 생성된다. root [CHANGELOG.md](./CHANGELOG.md)는 publish 시점에 release PR 작성자가 per-package CHANGELOG를 참고해 수동으로 큐레이트한다. publish 직후 release.yml 의 FF sync step 이 main 을 dev tip 으로 자동 갱신한다.

- bump type 기준은 [docs/release-policy.md](./docs/release-policy.md). 모르면 PR 본문에 후보를 적고 리뷰에서 결정.
- chore / docs only PR은 changeset 추가 안 함. CHANGELOG는 사용자 영향이 있는 변경만 기록.

## 9. 기여자 라이선스

이 저장소는 [Apache License 2.0](./LICENSE)으로 배포됩니다.

PR을 제출하시면 본인의 기여(코드, 문서, 설정 등)가 동일하게 Apache-2.0 조건으로 라이선스됨에 동의한 것으로 간주됩니다. 별도의 CLA / DCO 절차는 운영하지 않습니다 — Apache-2.0 §5(Submission of Contributions)에 따른 묵시적 grant를 그대로 따릅니다.

다른 라이선스로 기여하고자 하는 경우, PR 본문에 명시해 주시면 별도로 검토합니다.

## 10. i18n / 다국어 docs (issue #154)

외부 가시 docs 는 영문 / 한글 dual 로 유지된다. 영어가 npm registry / GitHub landing 의 default, 한글은 source of truth. 내부 docs (contributor / 운영자용) 는 contributor 한국 기반이라 한글 only 유지.

### dual 대상 파일

**영문 default + 한글 보존** (사용자 / 기여자 진입 친화):

- `README.md` (영어) + `README.ko.md` (한글)
- `SECURITY.md` (영어) + `SECURITY.ko.md` (한글)

**한글 default + 영문 추가** (`docs/X.md` + `docs/X.en.md`, 7개):

- `docs/architecture.{md,en.md}`
- `docs/auth-architecture.{md,en.md}`
- `docs/auth-cli.{md,en.md}`
- `docs/cli-json-output.{md,en.md}`
- `docs/provider-notes.{md,en.md}`
- `docs/telegram-bot.{md,en.md}`
- `docs/typescript-consumers.{md,en.md}`

**한글 only 유지** (외부 사용자 가시도 낮음 / contributor 한국 기반):

- `CONTRIBUTING.md`, `CHANGELOG.md`
- `docs/codebase-guide.md`, `docs/release-policy.md`, `docs/auth-store-schema.md`, `docs/claude-oauth-plan.md`
- `docs/INDEX.md` (한글이 default, 외부 docs 영문 link 컬럼으로 노출)
- `.changeset/*.md` (release-policy §3)
- `CODE_OF_CONDUCT.md` 는 영어 표준 텍스트 — 그대로 유지

### 기본 원칙

- **source of truth**: 한글. 영문은 번역본 — README / SECURITY 는 영어 파일명이 `.md` 지만 의미상 한글이 원본.
- **drift 방지**: 한글 변경 시 영문 동시 갱신 의무. **같은 PR 에 양쪽 변경 포함** — 별도 PR 로 split 금지.
- **불변 요소**: 코드 식별자 / 외부 lib name / 경로 / 명령 예시 / changeset 본문 / d.ts 시그니처 / endpoint URL / scope / client_id — 양쪽 동일.
- **번역 footer**: 영문 본 상단에 `> Translated from [X.ko.md](./X.ko.md) — last sync YYYY-MM-DD` (또는 `docs/X.md`) 형식. 한글 변경 PR 마다 sync 날짜 갱신.
- **상호 링크**: dual 파일 둘 다 상단에 `🌐 [English](./X.md) · [한국어](./X.ko.md)` 형식 dual link (`docs/*.en.md` / `.md` 도 동일 패턴).
- **dual sync 검증**: `packages/agent/test/integration/repo-policy-i18n.test.js` 가 영문 본 존재 / 상호 link / 번역 footer 존재 / dual 파일 정합을 검사. 한쪽만 변경한 PR 은 본 test 가 잡는다.

### 번역 작업 흐름

1. **한글 source 변경 PR** 작성 시 영문 본도 같은 PR 안에서 갱신.
2. AI 번역 도구 (Claude API 등) 로 1차 draft 가능 — 코드 식별자 / 옵션 / 경로 등 불변 요소가 그대로 유지되는지 사람이 review.
3. 영문 본의 번역 footer `last sync` 날짜를 변경 시점으로 갱신.
4. `repo-policy-i18n.test.js` 통과 확인.

### `auth import` / `manual paste` 같은 의미적 정합

번역 시 한글 source 의 표현이 outdated 라면 source 도 동시 정정. self-review / 외부 review 가 양쪽 mismatch 를 발견하면, **한글 source + 영문 본 + 관련 코드 docstring** 까지 한 commit 에 갱신 (CONTRIBUTING §6 의 "외부 식별자 원문 유지" + §4 의 "1 PR 1 주제" 와 양립).

### CLI / `--json` / changeset 정책 정합

- CLI 평문 (`token-weather status` desktop) 의 한글 / 영어 출력은 본 §10 의 대상이 아님. 평문 출력 언어 정책은 [docs/codebase-guide.md](./docs/codebase-guide.md) 참고 (현재 영어 default — issue #116).
- `--json` 출력은 stable contract 라 본 §10 무관 — schema bump 정책은 [docs/release-policy.md](./docs/release-policy.md) §3.
- changeset 본문은 한 언어 (한글) 유지 — release-policy §3 정합. 사용자 가시 변경 요약이 양쪽 언어로 노출될 필요 없음.

### dual 대상 / 진행 상황 추적

[docs/INDEX.md](./docs/INDEX.md) 의 "외부 사용자용" 표가 카테고리별 entry point + 각 docs 의 dual 상태. 새 외부 docs 추가 시 INDEX 의 표에 행 추가하고 영문 본도 같은 PR 에 포함.
