---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

docs(repo): 외부 가시 docs 보조 4개 영어 번역 — architecture / auth-architecture /
auth-cli / typescript-consumers (issue #154 Phase 2-3).

Phase 2-1 (README dual) + Phase 2-2 (외부 핵심 3개) 에 이어, 외부 가시 docs 의
나머지 4개를 영어 번역. 외부 사용자 진입도 모든 외부 docs 영어 본 보유 — README
의 영어 본 ToC link 가 7개 docs 모두 `.en.md` 를 가리킴.

**변경 사항**:

- `docs/architecture.en.md` 신규 (77 lines) — 고수준 구성 / CLI agent / services /
  provider adapters / schemas / 인증 계층 / 확장 후보
- `docs/auth-architecture.en.md` 신규 (184 lines) — 인증 흐름 4종 / credential
  source 우선순위 / 저장소 설계 / 보안 원칙 / 자동 refresh / Codex / Claude
  endpoint 검증 현황 / 운영 방안
- `docs/auth-cli.en.md` 신규 (204 lines) — auth login / list / logout / import +
  doctor (--dedupe / --apply / --backfill-account-id) / multi-account / port
  conflict / 자동 refresh / 예시 시나리오
- `docs/typescript-consumers.en.md` 신규 (116 lines) — d.ts emission 정책 / 현재
  d.ts 품질 / manual sanity check 절차 / 한계
- `docs/INDEX.md` 갱신 — 외부 사용자용 표 7행 모두 영문 본 노출
- `README.md` (영어) 본문 / ToC 의 link 4개 갱신: architecture / auth-architecture /
  auth-cli / typescript-consumers → .en.md
- `repo-policy-readme.test.js` REQUIRED_LINKS 갱신: `docs/auth-architecture.md` →
  `docs/auth-architecture.en.md`

**번역 정책 정합** (CONTRIBUTING §6 + §10):

- 명령 / 옵션 / endpoint URL / scope / client_id / 경로 / 환경변수 — 양쪽 동일
- 표 / 단계 흐름 / 예시 코드 — 한글 source 와 동일 구조
- 영문 본 상단 번역 footer + CONTRIBUTING §10 ref

**Non-goal** (Phase 2-4 마무리):

- SECURITY.md 영어화
- CONTRIBUTING §10 의 운영 절차 보강 (test 가드 / dual sync 검증)
- 내부 docs (codebase-guide / release-policy / auth-store-schema / claude-oauth-plan) 한글 유지
