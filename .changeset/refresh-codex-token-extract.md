---
'@token-weather/cli': patch
'@token-weather/provider-adapters': patch
'@token-weather/schemas': patch
---

refactor(adapters): `refreshCodexToken` 을 dedicated `codex/refresh-codex-token.js` 로 분리. 기존엔 `codex/exchange-codex-authorization-code.js` 안에 inline 으로 있어 `claude/refresh-claude-token.js` 와 위치 비대칭이었음. public API 변화 없음 — 모든 소비자가 `@token-weather/provider-adapters/src/codex/index.js` 를 통해 import 하므로 호출 사이트 변경 0. 두 provider 가 `refresh-*-token.js` 의 동일한 파일 구조로 정렬되어 미래 provider 추가 시 패턴 따라가기 쉬워진다 (issue #105 의 일부).
