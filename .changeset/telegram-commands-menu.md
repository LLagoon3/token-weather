---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

feat(telegram): Telegram 봇 슬래시 명령 자동완성 메뉴 + `/help` (issue #148).

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
