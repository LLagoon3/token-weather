---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

feat(telegram): grammy 기반 봇 코어 — long-poll daemon / 명령 라우터 / allowlist / formatter (issue #127).

5-phase Telegram 봇 통합 plan 의 Phase 2. Phase 1 의 scaffold 위에 실제 long-poll
daemon lifecycle 과 미들웨어 / 출력 가공 helpers 를 채운다. 명령 핸들러 / `run-cli`
연결은 Phase 3 (#128).

**중요 — Phase 2 publish 성격**:

본 release 의 `@token-weather/telegram` 은 아직 **end-user 가 단독 사용할 수 없는
상태** 이다. `runTelegramCommand` 는 여전히 Phase 1 placeholder 라 `token-weather
telegram` 명령은 Phase 3 머지 후 활성화. 다만 Phase 2 에서 공개되는 helpers
(`createBotServer` / `parseCommand` / `authAllowlistMiddleware` / `wrapPre` 등) 는
외부 사용자가 직접 import 해 자체 봇을 띄울 수 있는 **부분적 API** 가 된다.

**신규 public export** (`@token-weather/telegram`):

- `createBotServer({ botToken, allowedChatIds, dispatcher, logger }) → { start, stop, bot }`
  — grammy `Bot` 인스턴스 + token-weather 미들웨어 + 라우팅을 묶은 factory.
  `start()` 는 fire-and-forget polling 시작, 409 Conflict (단일 인스턴스 lock 위반)
  시 친절한 메시지 + `process.exitCode = 1`.
- `startBot(config)` / `stopBot()` — process 단일 인스턴스 lock 보강 래퍼.
- `parseCommand(text)` — slash 명령 파싱 + `/cmd@MyBot` mention strip + lowercase
  정규화. non-command 입력 모두 null.
- `listAvailableCommands(dispatcher)` — dispatcher 의 키를 `/cmd` 형식으로 정렬해
  안내 문구 직렬화.
- `authAllowlistMiddleware(allowedChatIds, opts?)` — `ctx.from.id` 가 allowlist 에
  없으면 silent ignore (응답 X, 로그만 부분 마스킹). 봇 토큰 누설 시 1차 방어막.
- `maskChatId(id)` — 4 자 이하 전체 / 5+ 자 부분 마스킹 (`123****90`).
- `stripAnsi(text)` — ANSI CSI sequence 제거. `eslint no-control-regex` lint-safe
  하게 `String.fromCharCode(0x1b)` + `RegExp` 생성자 사용.
- `wrapPre(text)` — Telegram HTML 모드 `<pre>` wrap + `< > &` escape.
- `splitForTelegram(text, limit=4000)` — 4096 자 한도 + tag overhead 안전 마진.
  줄 단위 split, 한 줄이 limit 초과 시 글자 단위 강제 분할.
- `formatErrorForTelegram(err)` — name + message 만 노출 (stack 제외) + HTML
  escape — XSS 방지 + 정보 노출 최소화.

**의존성 정책** (PR #131 review 정합):

본 패키지는 `@token-weather/cli` 를 import 하지 않는다. `runTelegramCommand` 의
`deps` 매개변수 + `createBotServer` 의 `dispatcher` 매개변수가 CLI 가 주입하는
core 함수의 통로 — 순환 의존 회피.

**SCHEMA_VERSION** 무변경. **Migration** 없음 — 외부 사용자가 본 API 를 아직
공식 의존하지 않는다는 전제 (NotImplemented 라벨링 유지).
