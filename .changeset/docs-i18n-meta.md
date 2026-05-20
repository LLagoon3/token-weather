---
'@token-weather/cli': patch
'@token-weather/provider-adapters': patch
'@token-weather/schemas': patch
'@token-weather/telegram': patch
---

docs(repo): i18n 메타 정비 마무리 — SECURITY 영어 default + CONTRIBUTING §10 정식 +
dual sync test 가드 (issue #154 Phase 2-4).

Phase 2-1 (README dual) / 2-2 (외부 docs 3개) / 2-3 (외부 docs 4개) 에 이어
i18n roadmap 의 마지막 단계 — 메타 파일 정합 + drift 방어막.

**변경 사항**:

- `SECURITY.md` → `SECURITY.ko.md` rename + `SECURITY.md` 영어 신규 + 양쪽 dual
  language 링크. 외부 보안 신고 (GitHub Security Advisory) 진입 시 영어 default.
- `CONTRIBUTING.md §10` skeleton → 정식 본:
  - dual 대상 파일 분류 (README/SECURITY 영문 default + 외부 docs 7 영문 추가 +
    한글 only 분류)
  - 기본 원칙 (source of truth / drift 방지 / 불변 요소 / 번역 footer /
    상호 링크 / dual sync 검증) 명확화
  - 번역 작업 흐름 (AI draft + 사람 review + footer last sync 갱신)
  - 의미적 정합 fix (source outdated 발견 시 한글 + 영문 동시 갱신)
  - CLI 평문 / `--json` / changeset 정책 분리 ref
- 새 test `packages/agent/test/integration/repo-policy-i18n.test.js` (40 test):
  - dual 대상 파일 존재 (16 파일)
  - 상단 dual language 링크 + globe 글리프
  - 영문 본 번역 footer + last sync 날짜
  - README 영어 본 link 가 외부 docs 7개 모두 `.en.md`
  - 한글 source 의 한글 헤더 (역번역 회귀 차단)

**i18n roadmap 종료** (issue #154):

- ✅ README dual (영문 default + .ko.md)
- ✅ SECURITY dual (영문 default + .ko.md)
- ✅ 외부 docs 7개 영문 본 추가
- ✅ CONTRIBUTING §10 정식 정책
- ✅ repo-policy-i18n test 가드 (drift 방어막)
- ✅ docs/INDEX.md 카테고리별 entry point

**Non-goal** (별도 후속 / Out of scope):

- Docusaurus / VitePress 기반 독립 docs 사이트
- 자동 번역 CI (AI 호출)
- 다른 언어 (일본어 / 중국어 등) — 영어 dual 후 별도 사이클
- 내부 docs (codebase-guide / release-policy / auth-store-schema /
  claude-oauth-plan) 영어화 — contributor 한국 기반 유지
