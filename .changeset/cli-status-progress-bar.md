---
'@token-weather/cli': patch
'@token-weather/provider-adapters': patch
'@token-weather/schemas': patch
---

feat(agent): `cli:status` 평문 출력에 `usedPercent` ASCII 막대 그래프 추가 + 컬러 임계값 (green<50 / yellow<80 / red≥80). `NO_COLOR` env / non-TTY / `TERM=dumb` 환경에서는 ANSI escape 없이 plain block char 만 렌더링 — `process.stdout.isTTY` + env 기반 자동 판별. `formatWindow` 의 `used_percent=N, reset_at=...` 텍스트가 `kind padEnd(12) + [████░░░░] + N%  reset_at=...` 한 줄 표기로 완전 대체된다. 함께 `status` / `usage` 평문 출력 전체 영어화 — 헤더 / 라벨 / 상태 / 에러 메시지 / `--help` 까지 (issue #116).

`--json` 출력 / `SCHEMA_VERSION` / `usage-snapshot.schema.json` / `auth-store-schema.js` / public API (`packages/agent/src/index.js`) / d.ts surface 모두 무변경 — JSON contract 그대로 통과. `doctor` 명령 출력은 별도 path (`doctor-helpers.js`) 라 영향 없음.

**Migration**: 외부 스크립트가 status 평문에서 `used_percent=N` substring 을 파싱하거나 `'명령:' / '상태:' / '플랜:' / '에러:' / '계정:' / '인증 소스:' / '비활성화됨' / '호출 안 함'` 같은 한글 라벨을 매칭하던 경우, 안정적인 contract 인 `status --json` 으로 옮기는 것을 권장. 평문은 release-policy §1 / `docs/cli-json-output.md` 가 stable contract 아님을 명시한다.

신규 helper (`packages/agent/src/cli/status-bar-helper.js` — `shouldUseColor` / `levelForPercent` / `colorize` / `formatProgressBar`) 는 agent 패키지 CLI 내부이며 외부 export 면 변화 없음. runtime dep 0 정책 유지 (chalk / cli-progress 미도입, Unicode block char + raw ANSI escape 직접 출력).
