---
'@token-weather/cli': patch
'@token-weather/provider-adapters': patch
'@token-weather/schemas': patch
---

docs(cli-json-output): contract 정합 보강 + top-level `schemaVersion` lock 회귀 가드 (issue #121).

3-phase JSON contract 정리 plan 의 Phase 3 (Phase 1 #119 / Phase 2 #120 의 docs / 테스트 fall-through). public API / 출력 shape / SCHEMA_VERSION 모두 무변경 — patch bump.

**Docs 보강** (`docs/cli-json-output.md`):

- Top-level shape 표에 "부재 시" 컬럼 추가 (옵셔널 필드의 default 표기).
- 신규 §"필드 부재 정책 — null vs 키 부재": 모든 정의 키는 항상 present, 값이 null 인지 확인하는 패턴 안내.
- 신규 §"`authSource` enum 값": 4 값 (`agent-store` / `codex-cli-import` / `claude-cli-import` / `not-found`) 의미 + enum 변경의 SCHEMA_VERSION 트리거 명시.
- 신규 §"`raw` 영역 책임 (provider adapter 계약)": SENSITIVE_KEYS 가 미치지 못하는 free-form subtree 의 위험 + provider adapter 3 책임 명시.

**회귀 가드** (`packages/agent/test/cli/status-json.test.js`):

- 신규 describe "formatStatusJson — top-level schemaVersion lock (issue #121)": `formatStatusJson` 통과 schemaVersion 이 `packages/schemas` 의 SCHEMA_VERSION 과 일치 단언 + key 항상 present 단언 + providerFilter / accountFilter / disabled provider 등 모든 출력 경로에서 schemaVersion 통과 단언.

이 가드 덕에 SCHEMA_VERSION 변경이 한 곳만 bump 되는 회귀를 차단 — `packages/schemas/test/schema-version.test.js` (값 lock) 와 본 가드 (status --json 통과 경로 lock) 가 함께 동작.
