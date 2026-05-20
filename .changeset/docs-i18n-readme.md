---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

docs(repo): README 영어 default 전환 — npm registry / GitHub 진입 시 영어권 사용자
친화 (issue #154 Phase 2-1).

기존 한글 `README.md` 를 `README.ko.md` 로 rename (git history 보존) + 영문
번역본을 `README.md` 위치에 신규. 양쪽 파일 상단에 dual language 링크 +
번역 정책 footer.

**왜 minor bump 인가**:

- 사용자 가시 진입 경로가 영어로 확장됨 (npm.com 의 readme 탭이 영어 표시,
  외부 사용자 진입 시 첫 인상 변화)
- 코드 / CLI / `--json` contract 변경은 없음 — 새 기능 / fix 도 없음
- 그래도 npm publish 의 user-facing change 로 분류 (README 가 publish artifact
  의 일부이고, 영문 default 가 search / discovery 에 직접 영향)
- patch 보다 minor 가 정합 — release-policy §3 의 "사용자 가시 변경" 범주

**Non-goal** (별도 후속 PR):

- `docs/` 하위 외부 가시 docs 영어 번역 — Phase 2-2 / 2-3
- SECURITY.md 영어화 — Phase 2-4
- CONTRIBUTING §10 i18n drift 방지 정책 — Phase 2-4
- 내부 docs (codebase-guide / release-policy) 영어화 — 보류 (contributor 한국 기반)

번역 정책 (CONTRIBUTING §6 정합):

- source of truth: 한글 (`README.ko.md`). 영어는 번역본.
- 코드 식별자 / 외부 lib name / 경로 / 명령 예시는 양쪽 동일.
- 한글 변경 시 영어 동시 갱신 의무 — CONTRIBUTING §10 (Phase 2-4 신설 예정).
