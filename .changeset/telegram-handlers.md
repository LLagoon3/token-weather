---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

feat(telegram): MVP 5명령 핸들러 + `token-weather telegram start` (issue #128).

5-phase Telegram 봇 통합 plan 의 Phase 3. Phase 2 의 코어 (long-poll / router /
allowlist / formatter) 위에 실제 명령 핸들러 (status / usage / status --json /
doctor / auth_list) 를 채우고, `@token-weather/cli` 의 `run-cli` 가 `telegram`
서브명령을 dynamic import 로 호출하도록 통합. 본 release 부터 `token-weather
telegram start` 가 end-user 가 사용 가능한 명령으로 활성화 (config 의 botToken /
allowedUserIds 가 채워진 환경에서).

**Agent 명령형 → 데이터 반환형 분리** (`@token-weather/cli` 의 비파괴 리팩터):

- `collectDoctorReport()` / `formatDoctorReportLines(report)` — `runDoctorRoot`
  의 출력을 데이터 수집 + 평문 줄 변환으로 분리. CLI 의 외부 동작 무변경.
- `collectAuthListData(provider, opts?)` / `formatAuthListLines(data, opts?)`
  — `runAuthListCommand` 의 출력을 동일 패턴으로 분리. CLI 의 평문 출력은
  기존과 1:1 동일.

**신규 public export** (`@token-weather/telegram`):

- `createStatusHandler(deps)` / `createStatusJsonHandler(deps)` /
  `createUsageHandler(deps)` / `createDoctorHandler(deps)` /
  `createAuthListHandler(deps)` — 5 명령 handler factory. 각 factory 는 deps
  로 cli 의 core 함수 (getStatusSnapshot / formatStatusOutput / formatStatusJson
  / collectDoctorReport / formatDoctorReportLines / collectAuthListData /
  formatAuthListLines) 를 받아 `(ctx, args) => Promise<void>` 반환.
- `buildDispatcher(deps) → Record<cmd, handler>` — 5 명령 dispatch 표 조립.
  `/status` `/usage` 의 `--json` 분기를 본 모듈이 책임 (핸들러 자체는 단일
  책임).
- `runTelegramCommand(argv, deps)` 본격 구현 — Phase 1 placeholder 던지던
  상태에서 `start` 서브명령 진화. config 의 channels.telegram 검증 (enabled
  / botToken / allowedUserIds) 후 buildDispatcher + startBot 흐름.
- `formatTelegramHelp()` — `--help` 안내 텍스트.

**CLI 통합**:

- `packages/agent/src/cli/run-cli.js` 에 `telegram` 분기 추가. `@token-weather/
telegram` 을 dynamic import (`ERR_MODULE_NOT_FOUND` / `MODULE_NOT_FOUND` 시
  친절 안내 + exit 1). 8 core 함수 (status / doctor / auth-list / config-path)
  를 deps 로 묶어 주입.
- `formatGlobalHelp` 에 `telegram start` 한 줄 추가.

**Doctor 노출 범위** (Phase 3 plan 결정):

`/doctor` 는 기본 호출만 — 인자 / subcommand 전달 안 함. `runDoctorCodex` /
`runDoctorClaude` / `--refresh-live` 등은 Telegram 표면에서 의도적으로 차단
(보안 표면 최소).

**부수 변경**:

- `package.json` 의 `test` glob 을 `find` 기반으로 갱신 — bash `globstar` off
  환경에서 `packages/<pkg>/test/**/*.test.js` 패턴이 1단계 dir 만 매칭하던
  문제 (telegram 의 `handlers/` 하위 디렉토리 도입 시 root-level test 가 빠짐)
  해소. 모든 depth 의 .test.js 자동 매칭, 후속 다단 확장에도 무변경.
- `handleTextMessage` 의 dispatcher 미등록 응답 메시지 — Phase 2 의 placeholder
  ("Phase 3 머지 후 활성화") 가 Phase 3 머지된 시점에 부정확 → "알 수 없는
  명령입니다: /xxx\n사용 가능한 명령: ..." 로 갱신.

**의존성 정책** (PR #131 review 정합):

`@token-weather/telegram` 은 여전히 `@token-weather/cli` 를 import 하지 않는다.
`runTelegramCommand` 의 `deps` 매개변수 + `createBotServer` 의 `dispatcher`
매개변수가 통로 — 본 phase 에서 의존성 주입 패턴이 통합 e2e 까지 통과함을
router-e2e.test.js 가 lock.

**SCHEMA_VERSION** 무변경 — status --json contract 무영향. **Migration** 없음.
