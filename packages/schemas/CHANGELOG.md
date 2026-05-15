# @token-weather/schemas

## 0.5.0

### Minor Changes

- ddd2f74: feat(telegram): grammy 기반 봇 코어 — long-poll daemon / 명령 라우터 / allowlist / formatter (issue #127).

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
  - `extractMention(text)` — `/cmd@mention` 의 username 부분 반환. bot-server 의
    silent ignore 경로에서 사용 (PR #133 추가 review).
  - `handleTextMessage(ctx, { dispatcher })` — `message:text` 처리 helper.
    다른 봇 mention 은 silent return (reply 도 보내지 않음 — group chat 의 다른
    봇 명령에 token-weather 가 응답하지 않도록, PR #133 추가 review).
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

- f5a634c: feat(telegram): Telegram 봇 슬래시 명령 자동완성 메뉴 + `/help` (issue #148).

  #144 (PR #145) / #146 (PR #147) 의 후속. 사용자가 텔레그램 채팅 입력창에서 `/` 만
  입력하면 client 가 명령 자동완성 메뉴를 띄우도록 [Bot API
  `setMyCommands`](https://core.telegram.org/bots/api#setmycommands) 를 boot 시점에
  호출. 동일 source 를 `/help` 응답으로도 회신.

  **변경 사항**:
  - `@token-weather/telegram` 새 모듈 `bot-commands.js`:
    - `BOT_COMMANDS` — 5개 명령 (status / usage / doctor / auth_list / help)
      단일 source. Telegram BotCommand 형식 `{command, description}`.
    - `formatHelpText(commands?)` — plain text 빌더 (HTML `<pre>` 미사용).
  - 새 핸들러 `handlers/help-handler.js`:
    - `createHelpHandler()` — deps 없이 `formatHelpText()` 결과를 reply.
  - `bot-server.js` 의 `createBotServer().start()`:
    - `bot.init()` 직후 `bot.api.setMyCommands(BOT_COMMANDS)` 호출. 실패해도
      daemon boot 자체는 진행 (warning log 만).
  - `dispatcher.js`:
    - `buildDispatcher` 반환 객체에 `help` 키 추가. 새 키는 deps 의존 없음.
  - `index.js` public export 추가: `BOT_COMMANDS`, `formatHelpText`,
    `createHelpHandler`.

  **Non-goal**:
  - 명령별 scope (default / private_chats / group / admin) 분리 — 본 PR 은
    default scope 만.
  - `/start` (페어링 외 일반 사용) 을 `/help` alias 로 처리 — 별도 이슈 후보.
  - CLI 평문 / `--json` contract 변경 없음.

- 1b03322: feat(telegram): MVP 5명령 핸들러 + `token-weather telegram start` (issue #128).

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
  - `createStatusHandler(deps)` / `createStatusJsonHandler(deps, opts?)` /
    `createUsageHandler(deps)` / `createDoctorHandler(deps)` /
    `createAuthListHandler(deps)` — 5 명령 handler factory. 각 factory 는 deps
    로 cli 의 core 함수 (getStatusSnapshot / formatStatusOutput / formatStatusJson
    / collectDoctorReport / formatDoctorReportLines / collectAuthListData /
    formatAuthListLines) 를 받아 `(ctx, args) => Promise<void>` 반환.
    `createStatusJsonHandler` 는 `options.command` 옵션으로 JSON top-level
    `command` 값을 받아 CLI `runStatusCommand` 의 `--json` contract 와 정합 유지
    (`/status --json` → "status", `/usage --json` → "usage"; PR #134 review).
  - `buildDispatcher(deps) → Record<cmd, handler>` — 5 명령 dispatch 표 조립.
    `/status` `/usage` 의 `--json` 분기를 본 모듈이 책임 (핸들러 자체는 단일
    책임).
  - `runTelegramCommand(argv, deps)` 본격 구현 — Phase 1 placeholder 던지던
    상태에서 `start` 서브명령 진화. config 의 channels.telegram 검증 (enabled
    / botToken / allowedUserIds) 후 buildDispatcher + startBot 흐름.
  - `formatTelegramHelp()` / `formatTelegramStartHelp()` — `--help` 안내 텍스트.
    `telegram start --help` 도 자체 안내 출력 (PR #134 review — 다른 CLI subcommand
    와 동일한 --help 패턴 유지).

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
    해소. 모든 depth 의 .test.js 자동 매칭, 후속 다단 확장에도 무변경. (Windows
    native shell 호환 보완은 별도 task 로 분리 — PR #134 review 참고.)
  - `handleTextMessage` 의 dispatcher 미등록 응답 메시지 — Phase 2 의 placeholder
    ("Phase 3 머지 후 활성화") 가 Phase 3 머지된 시점에 부정확 → "알 수 없는
    명령입니다: /xxx\n사용 가능한 명령: ..." 로 갱신.
  - `formatPreChunksForTelegram` 의 split — escape 후 raw slice 대신 raw character
    단위 split (`splitRawByEscapedLength` helper) 로 갱신 — `&amp;` / `&lt;` /
    `&gt;` entity 가 chunk 경계에서 끊기지 않도록 보호 (PR #134 review).

  **의존성 정책** (PR #131 review 정합):

  `@token-weather/telegram` 은 여전히 `@token-weather/cli` 를 import 하지 않는다.
  `runTelegramCommand` 의 `deps` 매개변수 + `createBotServer` 의 `dispatcher`
  매개변수가 통로 — 본 phase 에서 의존성 주입 패턴이 통합 e2e 까지 통과함을
  router-e2e.test.js 가 lock.

  **SCHEMA_VERSION** 무변경 — status --json contract 무영향. **Migration** 없음.

- e074ac3: feat(telegram): OS service 자동 등록 옵션 — 5+ 줄 셸 명령 → Enter 한 번 (issue #138).

  5-phase plan (#126~#130) 의 후속 follow-up. Phase 4 (#129) 의 `telegram setup` 은
  OS service template 를 **print 만** 했는데, 본 release 부터 동의 기반 자동 등록을
  지원한다. 보안 도구 원칙 유지 — Y default 프롬프트 + 사용자 명시 n / detect skip
  시 기존 수동 안내 fallback.

  PR #136 review (메시지 #796) 의 오픈클로 게이트웨이 비교에서 출발 → 메시지 #798
  의 사용자 결정 사양 (Y default / skip+안내 / service+linger 까지만 uninstall) →
  본 release 가 구현.

  **신규 동작**:
  - `telegram setup` 의 마지막 단계가 `자동으로 설치하시겠습니까? [Y/n]` 프롬프트를
    표시:
    - **Y (default)**: token-weather 가 직접 systemd unit / launchd plist / Task
      Scheduler 항목을 작성 + 활성화 (`systemctl --user enable --now` /
      `launchctl bootstrap` / `schtasks /Create`). Linux 는 `loginctl enable-linger`
      까지 자동 (best-effort).
    - **n**: 자동 등록 건너뜀 → 기존 수동 안내 블록 출력 (Phase 4 와 동일).
    - **systemd / launchctl / schtasks 미감지** (WSL / Docker / Alpine OpenRC 등):
      자동 skip + 수동 안내 fallback. install 실패하지 않음.
  - 신규 서브명령 `telegram uninstall-service`:
    - 작성된 service 항목을 confirm (default Y) 후 제거.
    - 책임 범위: service 파일 + Linux linger 까지. **config / auth.json 은 건드리지
      않음** — 봇 설정 자체를 지우려면 사용자가 명시적으로 config 편집.

  **신규 public export** (`@token-weather/telegram`):
  - `installOsService(input, options)` / `uninstallOsService(options)` — OS detect →
    분기. 미지원 platform 은 `{ status: 'skipped' }`.
  - `installSystemdUnit` / `uninstallSystemdUnit` / `installLaunchAgent` /
    `uninstallLaunchAgent` / `installTaskScheduler` / `uninstallTaskScheduler` —
    OS 별 install / uninstall 실 구현.
  - `runUninstallServiceSubcommand(args, deps, options?)` —
    `telegram uninstall-service` 의 진입점.
  - `formatTelegramUninstallServiceHelp()` — `--help` 안내.
  - `parseYesNo(answer, defaultYes)` — Y/N 응답 파싱 helper.

  **부수 변경** (`@token-weather/telegram` 의 `os-service-templates.js`):
  - `linuxSystemdUnit` / `macosLaunchAgent` 의 반환 객체에 `content` / `serviceFilename`
    키 추가 — installer 가 직접 fs.writeFile 로 작성할 raw unit content. 기존
    `instructions` (manual heredoc) 은 그대로 보존, backward-compat 완전.

  **UX 비교**:

  | 기존 (#129)                            | 자동 등록 (본 issue)                     |
  | -------------------------------------- | ---------------------------------------- |
  | 1. setup 끝의 template 블록 보기       | 1. setup 끝의 `자동 설치 [Y/n]` 프롬프트 |
  | 2. 5+ 줄 셸 명령 셸에 복사 / 붙여넣기  | 2. Enter → 자동 등록 완료                |
  | 3. 무시하고 `telegram start` 수동 실행 | 3. 거부 시 기존 수동 안내 fallback       |

  5+ 줄 셸 명령 → Enter 한 번. 보안 원칙 (동의 필요) 유지.

  **위험 / Fallback**:
  - WSL / Docker container / Alpine OpenRC: `systemctl --version` 등 사전 detect →
    skip + 수동 안내. install 실패 X.
  - nvm / fnm path stale: install 완료 메시지에 "Node 버전 매니저 변경 시
    `telegram setup` 재실행 권장" 안내.
  - 기존 service 파일 충돌: hash 비교 → 다르면 confirm (default n) → 사용자 명시
    y 시만 덮어쓰기. Windows 도 동일 정책 — `schtasks /Query` 사전 검사 (PR #140
    review blocker 2).
  - 충돌 시 confirm 의 실 동작 정합 (PR #140 review blocker 1) — setup 경로에서
    `options.confirmFn` 미주입 시 자동으로 `promptFn` 기반 adapter build, 실제
    프롬프트로 사용자 결정 받음.
  - install 중간 실패: try / catch + **backup / restore** (PR #140 review). 기존
    파일이 있었으면 cleanup 시 unlink 대신 restore — 사용자 파일 손실 회피.
  - HOME / USER 환경변수 누락 (PR #140 review): HOME 없으면 status 'skipped' + manual
    fallback. USER 없으면 linger 단계만 skip + log 안내.
  - 경로 공백 / XML 특수문자 (PR #140 review): 사전 검사 (`hasUnsafePathChars`) →
    발견 시 즉시 status 'skipped' + manual 안내. 정확한 escaping helper 는 별도
    follow-up.
  - uninstall 의 linger 비활성화: 다른 user-level service 도 영향 가능 — 안내
    텍스트에 명시.

  **config / public API contract** 변경 없음 — `runSetupSubcommand` / `runTelegramCommand`
  의 시그니처 그대로, 동작 추가 + 신규 export 만.

  **Bump 의도** — `@token-weather/telegram` 의 동작 추가가 본질. linked 정책
  (release-policy §1, v0.x 단순성 우선) 으로 4 패키지 모두 minor 가 동시 누적.

  **문서**:
  - `docs/telegram-bot.md` — §빠른 시작 / §명령 표 / §OS service 등록 모두 갱신.
    자동 등록 / fallback / uninstall-service 흐름 안내. 기존 수동 등록 안내는
    fallback section 으로 보존.

- b3c5da3: chore(repo): @token-weather/telegram 워크스페이스 패키지 scaffold (issue #126).

  5-phase Telegram 봇 통합 plan (issue #126 ~ #130) 의 Phase 1. 신규 워크스페이스
  패키지 신설 + config / redaction 인프라 선 도입으로 후속 phase 의 코어 작업
  진입을 단순화. linked 정책에 따라 4 패키지 모두 같은 minor bump.

  **중요 — Phase 1 scaffold publish 성격**:

  본 release 의 `@token-weather/telegram` 은 **scaffold 단계**이며 public export
  `runTelegramCommand` 는 호출 시 NotImplemented 오류를 던진다. npm 사용자가 직접
  install 해 봇을 띄울 수 있는 단계가 아니다 — 실 동작은 Phase 3 머지 / 후속
  release 부터. package.json description 에 "Phase 1 scaffold" 라벨링.

  **신규 워크스페이스 패키지**:
  - `@token-weather/telegram` 초기 v0.4.0 진입 (다음 publish 시 linked 정책으로
    4 패키지 모두 v0.5.0 동시 진입).
  - placeholder `runTelegramCommand(argv, deps)` export — Phase 3 머지 시 실
    dispatch 로직이 채워짐. **`deps` 매개변수 (의존성 주입)** 시그니처는 scaffold
    단계에서 못 박음: 본 패키지가 `@token-weather/cli` 를 직접 import 하지 않고
    CLI 가 core 함수 묶음 (getStatusSnapshot / formatStatusOutput / formatStatusJson
    등) 을 deps 로 전달해 순환 의존을 방지한다 (PR #131 review 반영).
  - `grammy` ^1.42.0 신규 의존성 — long-poll 루프 / 미들웨어 추상화.

  **기존 패키지 변경** (`@token-weather/cli`):
  - `config.channels.telegram = { enabled: false, botToken: '', allowedUserIds: [] }`
    신규. `providers` (usage 조회 대상 — codex / claude) 와 의도적으로 분리 —
    PROVIDER_REGISTRY / `--provider` 필터 / `status --json providers[]` / `authSource`
    / `usageSnapshots` 가 모두 usage provider 의미에 묶여 있어, Telegram 같은
    transport / channel 은 별도 네임스페이스 (PR #131 review 반영). `allowedUserIds`
    는 `ctx.from.id` 기준 — DM / group 어디서든 동일 사용자 명령 가능 (PR #133
    review 반영).
  - `SENSITIVE_KEYS` 확장: `botToken` / `bot_token` / `telegramBotToken` —
    Phase 2 이후 raw 영역에 흘러갈 가능성 대비 redaction 가드 선 등록.
  - redaction 회귀 테스트 2건 신설 (`channels.telegram` 경로 fixture).

  **SCHEMA_VERSION** 무변경 — `status --json` contract 는 무영향 (telegram 키는
  별도 패키지가 단독 소비). **Migration** 없음 — 기존 사용자 동작 100% 호환.

- 6393b82: feat(telegram): 페어링을 Telegram deep link 로 단순화 — 5 step → 2 step (issue #137).

  5-phase plan (#126~#130) 의 follow-up. Phase 4 (#129) 의 `telegram setup` 페어링은
  사용자가 봇을 직접 찾아 `/pair TGW-XXXXXX` 를 손으로 입력하는 5 단계 흐름이었다.

  PR #136 review (메시지 #792) 에서 HetrixTools / UptimeRobot 류의 "공식 봇 + 백엔드
  페어링" 패턴 (클릭 한 번) 과 비교되었고, token-weather 의 보안 모델 (로컬 only /
  공식 봇 없음) 위에서도 **Telegram deep link** (`t.me/<bot>?start=<code>`) 로 사용자
  단계를 1 클릭으로 줄일 수 있음을 검토 (메시지 #797). 본 release 가 도입.

  **신규 동작** (`@token-weather/telegram`):
  - `runPairingBot` 의 message:text 핸들러가 `/pair <code>` 외에 `/start <code>` 도
    페어링 명령으로 인식 (regex `^\/(pair|start)\s+(\S+)\s*$`, **strict matching** —
    trailing arg 가 붙은 입력 silent ignore, PR #139 review). Telegram deep link
    클릭 시 전달되는 `/start` 명령을 페어링 전용으로 해석. backward-compat —
    기존 `/pair` 흐름 그대로.
  - `runSetupSubcommand` 의 페어링 안내 출력이 두 경로 모두 표시:
    - (A) deep link URL — `https://t.me/${botInfo.username}?start=${encodeURIComponent(code)}`
      (PR #139 review — code 형식 후속 변경 방어). 클릭 시 Telegram 앱이 봇 대화
      창으로 열림. 봇을 처음 여는 경우 "Start" 버튼 클릭 후 `/start <code>` 전달
      → 페어링 완료.
    - (B) 수동 `/pair <code>` 명령 — 기존 흐름 (사용자가 봇 검색 + 수동 입력).
  - pairing daemon 시작 log 메시지도 두 경로 모두 안내.

  **UX 비교**:

  | 기존 (#129)                       | deep link (#137)                                  |
  | --------------------------------- | ------------------------------------------------- |
  | 1. setup 출력의 `TGW-XXXXXX` 복사 | 1. setup 출력의 URL 클릭                          |
  | 2. Telegram 앱 열기               | 2. Telegram 앱 자동 열림 + `/start ...` 자동 전송 |
  | 3. 봇 검색 / 선택                 |                                                   |
  | 4. `/pair TGW-XXXXXX` 수동 입력   |                                                   |
  | 5. 전송                           |                                                   |

  **5 단계 → 2 단계**. BotFather 단계는 그대로 (자기 봇 모델의 본질).

  **문서**:
  - `docs/telegram-bot.md` — 빠른 시작 / 명령 표 / 봇 채팅 명령 표 모두 두 경로
    안내. `/start <code>` / `/pair <code>` 두 페어링 전용 명령을 봇 명령 표에 추가.

  **테스트**:
  - `pairing.test.js` — `/start <code>` 정상 페어링 + `/start <wrong-code>` mismatch
    대응 2 케이스.
  - `setup-subcommand.test.js` — deep link URL log 출력 + 기존 `/pair` 안내 보존
    단언.

  **backward-compat 완전** — 기존 `/pair <code>` 사용자는 동작 무변경. config /
  public API contract 변경 없음 — `runSetupSubcommand` / `runPairingBot` 의 시그
  니처 그대로, 출력 내용 + regex 의 strict matching 만 확장.

  **Bump 의도** — `@token-weather/telegram` 의 동작 추가가 본질. linked 정책 (PR
  #131 review 결정, v0.x 단순성 우선) 으로 4 패키지 모두 minor 가 동시 누적. v0.5.0
  publish 전 follow-up 의 일관성 유지.

- 547179e: feat(telegram): `/status`, `/usage` Telegram 응답의 window 라인에 progress bar 추가
  (issue #146).

  PR #145 (#144) 에서 모바일 폭 친화 compact 출력을 위해 제거했던 사용량 시각화를
  복원. CLI 의 `formatProgressBar` (width=50, ANSI 컬러) 를 그대로 쓰면 모바일 폭에
  박스가 깨지므로, Telegram `<pre>` 환경에 맞춰 ANSI 분기를 뺀 10-column 사본을
  추가.

  **변경 사항**:
  - `@token-weather/telegram` public export 추가:
    - `compactProgressBar(percent, width = 10) → string` — 1/8 정밀도 fractional
      block (`█▏▎▍▌▋▊▉`) + light shade `░`. ANSI 컬러 미적용 (Telegram `<pre>` HTML
      미지원). null/NaN → 전부 `░`. 범위 외 → `[0, 100]` clamp.
  - `formatStatusForTelegram` 의 window 라인 포맷 갱신:
    - before: `· primary: 38%`
    - after: `· primary   ███▊░░░░░░  38%`
  - 라인 폭: `· ` (2) + label `padEnd(9)` + space + bar (10) + space + pct
    `padStart(4)` = **27 자** ≤ 32 column 가이드 유지.
  - 박스 글리프 (`╭ │ ╰ ┌ └ ─`) 회귀 가드는 그대로 유지 — bar 글리프 (`█ ░`) 만
    단언 배열에서 제거하고 "모든 window 라인에 bar 글리프 존재" 단언 추가.

  **Non-goal**:
  - CLI 평문 (`token-weather status` 데스크탑) 변경 — `formatProgressBar` 와
    컬러 정책 그대로 유지.
  - `--json` stable contract 변경 없음.
  - 컬러 / 상태 emoji (🟢🟡🔴) 는 별도 후속 이슈 후보.

- 1675cd6: feat(telegram): setup (페어링 + OS service template print) + check 진단 (issue #129).

  5-phase Telegram 봇 통합 plan 의 Phase 4. Phase 3 까지 `token-weather telegram
start` 만 활성화되었던 상태에서 **end-user 가 처음부터 끝까지 자체 봇을 띄울
  수 있는** 흐름을 완성한다 — 봇 토큰 prompt → getMe 검증 → `/pair <code>` 페어링
  → config write + chmod 600 → OS service template print. 진단용 `check` 도
  동시에 등록.

  **신규 public export** (`@token-weather/telegram`):
  - `validateBotToken(botToken, { fetchFn?, apiBase? })` — Telegram Bot API getMe
    로 token 유효성 검증. `{ ok, botInfo | error }`.
  - `generatePairingCode()` — 1회용 `TGW-XXXXXX` 코드 (0/1/I/O 제외, OCR 친화).
    `node:crypto.randomInt` 기반 — 1회용 authorization token 성격이므로 cryptographically
    secure RNG (PR #135 review).
  - `runPairingBot(botToken, expectedCode, { timeoutMs?, botFactory?, logger? })`
    — 페어링 전용 1회 daemon. allowlist 없이 `/pair <code>` 만 listen, ctx.from.id
    캡처 후 `{ userId, username }` resolve. 5 분 timeout, mock 주입 가능.
  - `linuxSystemdUnit` / `macosLaunchAgent` / `windowsTaskScheduler` /
    `pickServiceTemplate({ nodeBinPath, cliScriptPath, homeDir? })` — OS 별 service
    unit / plist / Task Scheduler 명령 블록 반환. pure, 파일 시스템 변경 X.
  - `runSetupSubcommand(args, deps, options?)` — 대화형 setup 흐름.
  - `runCheckSubcommand(args, deps, options?)` — read-only 진단.
  - `formatTelegramSetupHelp()` / `formatTelegramCheckHelp()` — 각 subcommand 의
    `--help` 안내.

  **CLI 통합** (`@token-weather/cli`):
  - `run-cli` 의 `telegram` 분기는 Phase 3 그대로 — `runTelegramCommand` 가 setup
    / start / check 모두 dispatch.
  - `formatTelegramHelp` 의 Subcommands 목록에 `setup` / `check` 추가 (start 와
    동급).
  - `runTelegramSubcommand` 의 deps 에 `createDefaultConfig` 주입 추가 — setup
    이 config 가 없을 때 default config 기반으로 시작하도록 (PR #135 review
    blocker — setup 직후 status/usage provider disabled 회피).

  **UX 정책** (PR #131 / #133 의 review 정신과 정합):
  - **자동 OS service 등록은 안 함** — print 만, 사용자가 복사 / 붙여넣기로
    활성화. 도구가 시스템 파일 (`~/.config/systemd/user/...` / `~/Library/
LaunchAgents/...`) 을 직접 만들지 않음. token-weather 의 "로컬 only" 약속
    표면적 최소화.
  - 페어링 daemon 은 1회용 — allowlist 없이 `/pair <code>` 만 listen, code 일치
    시 즉시 종료. createBotServer 의 single-instance lock 과 다른 lifecycle.
  - 모든 외부 의존성 (fetch / readline / Bot / fs / execSync / platform) 옵션
    주입 — 단위 테스트가 외부 네트워크 / 실 파일 / 실 bot 없이 e2e 시나리오 검증.

  **기존 패키지 변경** (`@token-weather/cli`):
  - `run-cli` 의 telegram deps 에 `createDefaultConfig` 추가 (PR #135 review
    blocker fix). Phase 3 의 8 deps 가 9 deps 로 확장.

  **SCHEMA_VERSION** 무변경 — status --json contract 무영향. **Migration** 없음.

  **다음 phase**: Phase 5 (#130) — docs/telegram-bot.md / README / SECURITY 갱신
  - release publish.

- 0a34296: feat(telegram): `/status`, `/usage` Telegram 응답을 모바일 폭 친화 compact 출력으로
  교체 (issue #144).

  기존에는 CLI 의 `formatStatusOutput` (데스크탑 80+ column 가정 — `╭─` rounded box +
  `━━━━ ... ━━━━━` 50–55 column heavy rule + 50 column progress bar) 출력을 그대로
  `<pre>` 로 감싸 보냈는데, 텔레그램 모바일 (폭 ~30–40 column) 에서 본문이 word
  wrap 되어 박스가 갈라지는 회귀가 있었음.

  **변경 사항**:
  - `@token-weather/telegram` 에 모바일 폭 친화 formatter 추가:
    - `formatStatusForTelegram(snapshot, ctx?) → string[]` — 라인 폭 ≤ 32 column,
      `━━ Title ━━` 짧은 section 라벨, 박스 / 50-column progress bar 미사용
    - `compactResetTime(isoDate, now?) → string` — `9:42pm` / `Sat 4:42am` /
      `May 22 3am` 형식. timezone 표기 생략 (모바일 폭 확보)
    - `TELEGRAM_LINE_WIDTH = 32` 상수
  - `status-handler.js` / `usage-handler.js` 가 `deps.formatStatusOutput` 대신
    새 formatter 호출. `formatPreChunksForTelegram` 4096 자 entity-safe chunking
    은 그대로 (PR #134 review 정합).
  - `dispatcher.js` 의 `TelegramDeps` jsdoc 에서 `formatStatusOutput` 항목 제거.
  - `@token-weather/cli` 의 `run-cli.js` 가 telegram 패키지로 주입하는 deps 에서
    `formatStatusOutput` 항목 제거 (telegram 패키지가 더 이상 요구하지 않음).
    CLI 평문 (`token-weather status` 데스크탑) / `--json` contract 는 변경 없음.

  **Non-goal**:
  - CLI 평문 출력 변경 — `formatStatusOutput` 는 데스크탑 사용자용으로 그대로 유지.
  - `--json` stable contract 변경 없음.
  - doctor / auth_list / status-json 핸들러는 폭 가정이 없어 영향 없음.

- a05d137: refactor(telegram)!: installer / uninstaller status `'installed'` → `'succeeded'` (issue #142).

  PR #140 (issue #138) review 라운드 2 에서 분리된 follow-up. 기존
  `uninstallOsService` 가 정상 완료 시 `{ status: 'installed' }` 를 반환해 외부
  consumer 가 "uninstalled 인데 status 가 installed?" 로 헷갈리던 contract 를 단일
  `'succeeded' | 'skipped' | 'failed'` 로 통일.

  **변경 사항**:
  - `installOsService` / `installSystemdUnit` / `installLaunchAgent` /
    `installTaskScheduler` 의 정상 완료 반환: `'installed'` → `'succeeded'`.
  - `uninstallOsService` / `uninstallSystemdUnit` / `uninstallLaunchAgent` /
    `uninstallTaskScheduler` 의 정상 완료 반환: `'installed'` → `'succeeded'`.
  - `InstallResult` typedef 의 status union: `'installed' | 'skipped' | 'failed'` →
    `'succeeded' | 'skipped' | 'failed'`.
  - 호출 측 분기 (`setup-subcommand.js` / `uninstall-service-subcommand.js`) 갱신.

  **Breaking change** — `@token-weather/telegram` 의 public API result shape 변경.
  PR #140 (이전 release) 의 result 와 호환 안 됨. 다만 PR #140 이 publish 전이라
  **외부 사용자가 본 API 에 의존하기 전에 처리** 하는 게 본 PR 의 의도.

  본 PR 머지 후 누적 release PR 머지 → v0.5.0 publish 시점에 `'succeeded'` 가
  첫 공식 contract.

  **Migration** (PR #140 의 pre-publish 사용자 한정):

  ```diff
  - if (result.status === 'installed') { ... }
  + if (result.status === 'succeeded') { ... }
  ```

### Patch Changes

- d10e10c: docs(telegram): docs/telegram-bot.md 신규 + README / SECURITY / release-policy 갱신 (issue #130).

  5-phase Telegram 봇 통합 plan 의 마지막 단계 (Phase 5). Phase 1~4 의 코드는 모두
  머지 완료, 본 release 로 사용자 문서 / 보안 운영 / release 정책을 통합 갱신해
  **v0.5.0 publish 준비**. 코드 변경 없음 — patch bump.

  **문서 갱신**:
  - `docs/telegram-bot.md` 신규 — quick start (npm install → telegram setup →
    telegram start) + 봇이 받는 채팅 명령 표 (`/status` / `/status --json` /
    `/usage` / `/usage --json` / `/doctor` / `/auth_list`) + OS service 수동 등록
    (systemd / launchd / Task Scheduler) + 보안 모델 + 한계 / FAQ.
    · §보안 모델 의 "로컬에 머무는 것" 을 세 저장 경로로 분리 명시:
    OAuth → `auth.json`, Telegram bot token / allowedUserIds → `config.json`,
    페어링 코드 → transient memory (PR #136 review blocker fix).
    · §OS service 수동 등록 에 "코드 블록은 구조 예시, 실제 경로는 setup 출력
    그대로 복사" 경고 (PR #136 review follow-up).
  - `README.md`:
    · "## 명령" 코드 블록에 telegram 3 명령 (setup / start / check) 등재.
    · 신규 "## Telegram 봇 (옵션)" 섹션 — 옵션 패키지 quick start 3 줄 + docs
    링크.
    · 헤더 한 줄 설명 + "What & Why" 의 "토큰 외부 서버 X" 약속을 **OAuth 토큰
    한정** 으로 정밀화 — 봇 활성화 시 사용량 메타데이터는 Telegram 경유 사실
    명시 + docs/telegram-bot.md §보안 모델 fragment 링크.
  - `SECURITY.md` — 신규 §"Telegram 봇 통합의 위협 모델": 신뢰 경계 (OAuth 토큰
    로컬 only vs 메타데이터 Telegram 경유), 1차 방어막 (allowedUserIds /
    single-instance lock / 노출 명령 표면 축소), 봇 토큰 누설 시 절차
    (BotFather /revoke → setup 재실행 → check), 추가 신고 시나리오. 신뢰 경계
    의 저장 경로 분리는 `docs/telegram-bot.md` 와 1:1 표현 (PR #136 review blocker
    fix).
  - `docs/release-policy.md` §2 (도메인별 자세한 기준) 에 신규 §"Telegram 봇" —
    subcommand / config 키 / deps 시그니처 / 응답 출력 / 미들웨어 정책 변경의
    bump 기준 명시. publish 전 단계의 정정 자유도 (PR #131 / #133 review 의
    키 이동이 가능했던 이유) 도 인용. linked 정책 + 안정성 평가 후 분리 가능성도
    후속 task 로 명시.

  **코드 변경 없음** — Phase 1~4 의 누적 minor bump 가 v0.5.0 진입을 만들어 둔
  상태. 본 release 의 docs 추가는 patch.

  **Migration** 없음.

## 0.4.0

### Minor Changes

- 01410bd: chore(agent)!: `status --json` 의 claude provider 영역에서 backward-compat alias 3 종 제거 (issue #119). `SCHEMA_VERSION` `'0.3.0'` → `'0.4.0'`. v0.x convention 상 breaking 도 minor + `!` prefix (release-policy §1 / §3).

  **Breaking changes**:
  - `.providers[].snapshot.networkUsage` (단일 객체) 제거 — `.providers[].snapshot.networkUsages[]` (배열) 만 유지.
  - `.providers[].snapshot.importedAccount` 제거 — `.providers[].snapshot.selectedAccount` 만 유지 (동일 값이었음).
  - `.providers[].snapshot.parsed` 제거 — `.providers[].snapshot.found` 만 유지 (항상 같은 값이었음).
  - `formatClaudeSection` (status-formatters / doctor-helpers) 의 legacy `networkUsage` (단일) fallback 코드 경로 제거 — 항상 `networkUsages[]` 배열만 처리.

  **Migration**:
  - `.providers[].snapshot.networkUsage` 참조 → `.providers[].snapshot.networkUsages[0].snapshot` (단일 계정) 또는 array 순회. **주의** — 이전 `networkUsage` 는 usage snapshot 객체 그대로였지만, 신규 `networkUsages[]` 의 각 원소는 `{ accountKey, account, snapshot }` wrapper. 실제 `usageWindows` / `status` 등 데이터는 `.snapshot` 안에 있어 `.snapshot` 단계 추가 필요. 자세한 예시는 `docs/cli-json-output.md` §"제거된 backward-compat alias (v0.4.0)".
  - `.providers[].snapshot.importedAccount` 참조 → `.providers[].snapshot.selectedAccount` 동일 의미.
  - `.providers[].snapshot.parsed` 참조 → `.providers[].snapshot.found` 동일 의미.

  `status --json` 외 평문 출력 / public API surface / runtime deps 무변경. 회귀 가드 — alias 키 부재 단언 신규 추가 (status-json.test.js / claude-provider.test.js / status-service.test.js).

- f4148ea: refactor(agent)!: `status --json` provider entry shape 정합 — codex / claude 키셋 동일화 (issue #120). `SCHEMA_VERSION` `'0.4.0'` → `'0.5.0'`. v0.x convention 상 breaking 도 minor + `!` prefix.

  **Breaking changes** (release-policy §1 의 키 제거 + 의미 변경 = major 트리거):
  - codex `.providers[].snapshot.snapshots[]` 키 → `.usageSnapshots[]` 로 rename.
  - claude `.providers[].snapshot.networkUsages[]` 키 → `.usageSnapshots[]` 로 rename.
  - claude `usageSnapshots[]` 원소 shape 정합 — 이전 `{ accountKey, account, snapshot }` wrapper 제거, **UsageSnapshot 객체 직접** 배열로 (codex 와 동일). `.snapshot.usageWindows` → `.usageWindows` 한 단계 짧아짐.
  - claude `.providers[].snapshot.detected` / `.found` 제거 → 단일 `.enabled` boolean 으로 통합 (codex 와 동일 키).
  - claude `.providers[].snapshot.selectedAccount` 제거 — default account 개념이 multi-account + 박스 UI 도입 후 의미가 약해져 양 provider 모두 미노출. 필요시 `.usageSnapshots[]` 순회로 식별.
  - claude `.providers[].snapshot.credentialsPath` 정책 정합 — 이전엔 항상 path 노출이었으나 v0.5.0 부터 `cli-import` 인증 소스 시점에만 path, 그 외엔 `null` (codex 와 동일 정책).

  **Migration**:

  ```js
  // before (v0.4.x)
  const codexEnabled = providers.find((p) => p.id === 'codex').snapshot.enabled;
  const codexSnaps = providers.find((p) => p.id === 'codex').snapshot.snapshots;
  const claudeEnabled = providers.find((p) => p.id === 'claude').snapshot.detected;
  const claudeFound = providers.find((p) => p.id === 'claude').snapshot.found;
  const claudeWindows = providers.find((p) => p.id === 'claude').snapshot.networkUsages[0].snapshot
    .usageWindows;
  const claudeAccount = providers.find((p) => p.id === 'claude').snapshot.selectedAccount;

  // after (v0.5.0+) — codex / claude 동일 path
  const provider = (id) => providers.find((p) => p.id === id).snapshot;
  const codexEnabled = provider('codex').enabled;
  const codexSnaps = provider('codex').usageSnapshots;
  const claudeEnabled = provider('claude').enabled;
  const claudeWindows = provider('claude').usageSnapshots[0].usageWindows; // wrapper 제거됨
  const claudeAccount = provider('claude').usageSnapshots.find(/* ... */)?.account;
  ```

  자세한 표 + 예시는 [`docs/cli-json-output.md`](docs/cli-json-output.md) §"Provider shape symmetry (v0.5.0)".

  **무영향**: 평문 출력 (`status` / `usage`) 사용자 가시 동일성 유지 — 내부 키 rename 만, 시각 표현 무변경. public API surface (workspace package 의 export) 무변경. runtime deps 무변경.

  회귀 가드 신설: `status-json.test.js` 에 codex / claude provider snapshot keyset 동일성 + legacy 키 부재 단언 (snapshots / networkUsages / networkUsage / detected / found / parsed / selectedAccount / importedAccount).

### Patch Changes

- 4be9bc1: feat(agent): `cli:status` 평문 출력에 `usedPercent` ASCII 막대 그래프 추가 + 컬러 임계값 (green<50 / yellow<80 / red≥80). `NO_COLOR` env / non-TTY / `TERM=dumb` 환경에서는 ANSI escape 없이 plain block char 만 렌더링 — `process.stdout.isTTY` + env 기반 자동 판별. `formatWindow` 의 `used_percent=N, reset_at=...` 텍스트가 `kind padEnd(12) + [████░░░░] + N%  reset_at=...` 한 줄 표기로 완전 대체된다. 함께 `status` / `usage` 평문 출력 전체 영어화 — 헤더 / 라벨 / 상태 / 에러 메시지 / `--help` 까지 (issue #116).

  `--json` 출력 / `SCHEMA_VERSION` / `usage-snapshot.schema.json` / `auth-store-schema.js` / public API (`packages/agent/src/index.js`) / d.ts surface 모두 무변경 — JSON contract 그대로 통과. `doctor` 명령 출력은 별도 path (`doctor-helpers.js`) 라 영향 없음.

  **Migration**: 외부 스크립트가 status 평문에서 `used_percent=N` substring 을 파싱하거나 `'명령:' / '상태:' / '플랜:' / '에러:' / '계정:' / '인증 소스:' / '비활성화됨' / '호출 안 함'` 같은 한글 라벨을 매칭하던 경우, 안정적인 contract 인 `status --json` 으로 옮기는 것을 권장. 평문은 release-policy §1 / `docs/cli-json-output.md` 가 stable contract 아님을 명시한다.

  신규 helper (`packages/agent/src/cli/status-bar-helper.js` — `shouldUseColor` / `levelForPercent` / `colorize` / `formatProgressBar`) 는 agent 패키지 CLI 내부이며 외부 export 면 변화 없음. runtime dep 0 정책 유지 (chalk / cli-progress 미도입, Unicode block char + raw ANSI escape 직접 출력).

- c648f24: docs(cli-json-output): contract 정합 보강 + top-level `schemaVersion` lock 회귀 가드 (issue #121).

  3-phase JSON contract 정리 plan 의 Phase 3 (Phase 1 #119 / Phase 2 #120 의 docs / 테스트 fall-through). public API / 출력 shape / SCHEMA_VERSION 모두 무변경 — patch bump.

  **Docs 보강** (`docs/cli-json-output.md`):
  - Top-level shape 표에 "부재 시" 컬럼 추가 (옵셔널 필드의 default 표기).
  - 신규 §"필드 부재 정책 — null vs 키 부재": 모든 정의 키는 항상 present, 값이 null 인지 확인하는 패턴 안내.
  - 신규 §"`authSource` enum 값": 4 값 (`agent-store` / `codex-cli-import` / `claude-cli-import` / `not-found`) 의미 + enum 변경의 SCHEMA_VERSION 트리거 명시.
  - 신규 §"`raw` 영역 책임 (provider adapter 계약)": SENSITIVE_KEYS 가 미치지 못하는 free-form subtree 의 위험 + provider adapter 3 책임 명시.

  **회귀 가드** (`packages/agent/test/cli/status-json.test.js`):
  - 신규 describe "formatStatusJson — top-level schemaVersion lock (issue #121)": `formatStatusJson` 통과 schemaVersion 이 `packages/schemas` 의 SCHEMA_VERSION 과 일치 단언 + key 항상 present 단언 + providerFilter / accountFilter / disabled provider 등 모든 출력 경로에서 schemaVersion 통과 단언.

  이 가드 덕에 SCHEMA_VERSION 변경이 한 곳만 bump 되는 회귀를 차단 — `packages/schemas/test/schema-version.test.js` (값 lock) 와 본 가드 (status --json 통과 경로 lock) 가 함께 동작.

## 0.3.0

### Minor Changes

- d262117: refactor(adapters)!: codex 폴백을 OpenClaw `auth-profiles.json` 에서 Codex CLI 자체 `~/.codex/auth.json` (`codex-cli-import`) 으로 교체 — claude 의 `claude-cli-import` 와 1:1 architectural symmetry (issue #113). 본 도구가 OpenClaw 환경 의존을 끊어내고 npm 일반 사용자에게도 의미 있는 폴백을 제공.

  **Breaking changes** (release-policy §1 major 트리거이지만 v0.x convention 상 minor):
  - `status --json` 의 `authSource` enum: `'openclaw-import'` 제거 + `'codex-cli-import'` 추가
  - `status --json` 의 `codex.authProfilesPath` 필드 → `codex.credentialsPath` (claude 와 동일 표면, `~/.codex/auth.json` 경로)
  - public export 제거: `readCodexAuthProfiles` / `getDefaultAuthProfilesPath` (`@token-weather/provider-adapters` 의 codex 영역)
  - 신규 public export: `readCodexCliCredentials` / `resolveCodexCliCredentialsPath` / `parseCodexCliCredentials` / `mapCodexCredentials` / `buildImportedCodexAccount` / `resolveImportedCodexAccounts` / `selectCodexAccountsSource` / `resolveImportedCodexSnapshot`
  - `SCHEMA_VERSION`: `'0.2.0'` → `'0.3.0'`
  - `auth-store-schema.js::CREDENTIAL_SOURCES` enum 정합 (incomplete 였던 enum 도 `'claude-cli-import'` / `'codex-cli-import'` 명시)

  **Migration**:
  - `status --json` 의 `.providers[].snapshot.authSource === 'openclaw-import'` 분기 → `'codex-cli-import'` 로 갱신
  - `.providers[].snapshot.codex.authProfilesPath` 참조 → `.credentialsPath`
  - OpenClaw 워크스페이스 사용자: 1회 `token-weather auth login codex` 실행 (또는 OpenClaw 측에서 `~/.config/token-weather/auth.json` 에 직접 inject 하도록 변경 — OpenClaw repo 후속 작업 영역)
  - `@token-weather/provider-adapters` 의 `readCodexAuthProfiles` 직접 import 한 consumer → `readCodexCliCredentials` + `buildImportedCodexAccount` 패턴으로 갱신

- 01ef74c: feat(cli): `doctor codex/claude --dedupe` / `--apply` / `--backfill-account-id` 옵션 추가 — 같은 OAuth subject (sub 또는 email) 의 stale 레코드를 dry-run 으로 감지하고 `--apply` 로 정리. login 시점 자동 정리(PR #38) 이전에 누적된 legacy accountKey 또는 id_token 파싱이 부분 실패한 레코드를 retroactive 로 청소 (issue #37). 자세한 사용법은 [docs/auth-cli.md §doctor `--dedupe`](docs/auth-cli.md).
- 03cf249: refactor(adapters)!: claude `~/.claude/stats-cache.json` 의존 제거 — `status --json` 의 `claude.usage` 필드 + per-session/per-message 누적 통계 출력 + public export (`readClaudeStatsCache`, `parseClaudeStatsCache`, `resolveClaudeUsageSource`, `resolveClaudeUsageSourcePath`) 제거. 본 도구는 이제 network endpoint (`/api/oauth/usage`) 의 window 기반 사용률 정보 (five_hour / seven_day) 만 노출한다 — Codex 의 server-side rate-limit 모델과 architectural symmetry. v0.x convention 상 breaking 도 minor 로 bump (release-policy §1 의 major 트리거지만 v0.x).

  **Migration**: `status --json` 결과에서 `.providers[].snapshot.usage` 또는 `.providers[].snapshot.usage.source === 'stats-cache-json'` 분기를 사용하던 consumer 는 필드 부재로 갱신 필요. window 정보는 `.providers[].snapshot.networkUsage.usageWindows` 에서 그대로 받을 수 있다. 누적 통계가 필요하면 `~/.claude/stats-cache.json` 을 직접 파싱 — Anthropic 의 client-side artifact 라 본 도구가 추상화하지 않는다.

  (issue #110)

### Patch Changes

- 92f6d9d: refactor(adapters): `refreshCodexToken` 을 dedicated `codex/refresh-codex-token.js` 로 분리. 기존엔 `codex/exchange-codex-authorization-code.js` 안에 inline 으로 있어 `claude/refresh-claude-token.js` 와 위치 비대칭이었음. public API 변화 없음 — 모든 소비자가 `@token-weather/provider-adapters/src/codex/index.js` 를 통해 import 하므로 호출 사이트 변경 0. 두 provider 가 `refresh-*-token.js` 의 동일한 파일 구조로 정렬되어 미래 provider 추가 시 패턴 따라가기 쉬워진다 (issue #105 의 일부).

## 0.2.0

### Minor Changes

- 7ec3111: `auth login` default 가 실제 OAuth 토큰 교환으로 변경되었습니다 (이전 default 는 mock 저장).

  Breaking changes:
  - `--live-exchange` flag 제거 → `--mock` flag 신설 (default = 실제 OAuth)
  - Codex / Claude 의 옵션 표면 + 라우팅 + default 동작 모두 일관성 정렬
    - `runCodexManualPasteFlow` 별도 함수 제거 → 공통 `runManualPasteFlow` 로 통합
    - 두 provider 모두 `supportsMockCallback: true` + `saveMockAccount` 보유
  - `@token-weather/provider-adapters` 의 `allowLiveExchange` 매개변수 + `liveExchangeDisabledError` 함수 + 관련 export 모두 제거
  - `auth list` 출력에서 `liveToken` 라인 제거 (mock 필드만 유지)

  자세한 흐름은 [docs/auth-cli.md](https://github.com/LLagoon3/token-weather/blob/main/docs/auth-cli.md) 참고.
