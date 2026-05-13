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
(`createBotServer` / `parseCommand` / `authAllowlistMiddleware` 등) 는 외부 사용자가
직접 import 해 자체 봇을 띄울 수 있는 **부분적 API** 가 된다.

**신규 public export** (`@token-weather/telegram`):

- `createBotServer({ botToken, allowedUserIds, dispatcher, logger, botFactory? }) → { start, stop, bot }`
  — grammy `Bot` 인스턴스 + token-weather 미들웨어 + 라우팅을 묶은 factory.
  `start()` 는 boot 단계 (`bot.init()` 으로 token validation) 만 await 하고
  polling 은 fire-and-forget — boot 실패 시 lock 해제 + throw (재시도 가능).
  `botFactory` 옵션으로 테스트 mock 주입 가능 (PR #133 review).
- `startBot(config)` / `stopBot()` — process 단일 인스턴스 lock 보강. boot 실패
  시 `_activeServer` 미점유 → 재시도 가능 (PR #133 review).
- `parseCommand(text, { botUsername }?)` — slash 명령 파싱 + mention filtering.
  `/cmd@OtherBot` 처럼 다른 봇 mention 은 null 반환 (group chat 명령 충돌
  방지, PR #133 review). botUsername 미지정 시 기존 동작.
- `listAvailableCommands(dispatcher)` — dispatcher 의 키를 `/cmd` 형식으로 정렬해
  안내 문구 직렬화.
- `authAllowlistMiddleware(allowedUserIds, opts?)` — `ctx.from.id` 가 allowlist 에
  없으면 silent ignore. "허용된 사용자" 보안 모델 — DM / group / supergroup
  어디서든 동일 사용자가 명령 가능 (PR #133 review).
- `maskUserId(id)` — 4 자 이하 전체 / 5+ 자 부분 마스킹 (`123****90`).
- `stripAnsi(text)` — ANSI CSI sequence 제거. `eslint no-control-regex` lint-safe
  하게 `String.fromCharCode(0x1b)` + `RegExp` 생성자 사용.
- `wrapPre(text)` — Telegram HTML 모드 `<pre>` wrap + `< > &` escape.
- `splitForTelegram(text, limit=4000)` — **raw text 길이 기준** 줄 단위 split.
  escape entity expansion 영향 없는 plain text 분할용.
- `formatPreChunksForTelegram(rawText, limit=4000)` — **escape 후 + `<pre>` tag
  포함 길이 기준** chunking. HTML escape entity expansion (`&` → `&amp;`) 으로
  Telegram 4096 자 한도 초과 가능성을 차단 (PR #133 review).
- `formatErrorForTelegram(err)` — name + message 만 노출 (stack 제외) + HTML
  escape — XSS 방지 + 정보 노출 최소화.

**기존 패키지 변경** (`@token-weather/cli`):

- `config.channels.telegram.allowedChatIds` → `allowedUserIds` rename (PR #133
  review — `ctx.from.id` 기준 보안 모델 정합). Phase 1 의 release note (
  `.changeset/telegram-package-scaffold.md`) 도 함께 정정.
- SENSITIVE_KEYS redaction fixture 의 키 이름 동기 갱신.

**의존성 정책** (PR #131 review 정합):

본 패키지는 `@token-weather/cli` 를 import 하지 않는다. `runTelegramCommand` 의
`deps` 매개변수 + `createBotServer` 의 `dispatcher` 매개변수가 CLI 가 주입하는
core 함수의 통로 — 순환 의존 회피.

**SCHEMA_VERSION** 무변경. **Migration** 없음 — 외부 사용자가 본 API 를 아직
공식 의존하지 않는다는 전제 (NotImplemented 라벨링 유지).
