---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

docs(repo): 외부 가시 docs 영어 번역 — telegram-bot / cli-json-output /
provider-notes (issue #154 Phase 2-2).

README 영어 default 전환 (Phase 2-1) 에 이어, 외부 사용자 진입도가 가장 높은
3개 docs 의 영어 번역본 (.en.md) 을 추가. 영어권 사용자가 README 의 외부 docs
link 따라 갈 때 한 클릭으로 영어 본 접근 가능.

**변경 사항**:

- `docs/telegram-bot.en.md` 신규 — 봇 setup / 핸들러 / OS service 가이드 / 보안
  모델 / FAQ
- `docs/cli-json-output.en.md` 신규 — `status --json` stable contract,
  field-absence 정책, redaction 규약, v0.4.0 / v0.5.0 migration
- `docs/provider-notes.en.md` 신규 — provider 별 observed endpoint /
  client_id / refresh 동작 / 알려진 limits
- `docs/INDEX.md` 갱신 — 외부 사용자용 표에 '영문' 컬럼 추가. Phase 2-2 의 3
  개만 link 노출, 나머지 4 개 (architecture / auth-architecture / auth-cli /
  typescript-consumers) 는 Phase 2-3 예정 표기

**번역 정책 정합** (CONTRIBUTING §6 + §10):

- 한글 source (`docs/X.md`) 가 source of truth. 영문 `.en.md` 는 번역본.
- 코드 식별자 / 외부 lib name / 경로 / 명령 예시 / JSON shape key / endpoint
  URL / scope 명 — 양쪽 동일.
- 영문 본 상단에 번역 footer (`> Translated from ... last sync 2026-05-20`).

**Non-goal** (Phase 2-3 / 2-4 후속):

- `docs/auth-architecture.en.md` / `auth-cli.en.md` / `architecture.en.md` /
  `typescript-consumers.en.md` — Phase 2-3
- `SECURITY.md` 영어화 — Phase 2-4
- CONTRIBUTING §10 의 운영 절차 보강 (test 가드 등) — Phase 2-4
- 내부 docs (codebase-guide / release-policy) 영어화 보류
