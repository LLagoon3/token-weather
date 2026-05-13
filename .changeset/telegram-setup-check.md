---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

feat(telegram): setup (페어링 + OS service template print) + check 진단 (issue #129).

5-phase Telegram 봇 통합 plan 의 Phase 4. Phase 3 까지 `token-weather telegram
start` 만 활성화되었던 상태에서 **end-user 가 처음부터 끝까지 자체 봇을 띄울
수 있는** 흐름을 완성한다 — 봇 토큰 prompt → getMe 검증 → `/pair <code>` 페어링
→ config write + chmod 600 → OS service template print. 진단용 `check` 도
동시에 등록.

**신규 public export** (`@token-weather/telegram`):

- `validateBotToken(botToken, { fetchFn?, apiBase? })` — Telegram Bot API getMe
  로 token 유효성 검증. `{ ok, botInfo | error }`.
- `generatePairingCode()` — 1회용 `TGW-XXXXXX` 코드 (0/1/I/O 제외, OCR 친화).
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

**UX 정책** (PR #131 / #133 의 review 정신과 정합):

- **자동 OS service 등록은 안 함** — print 만, 사용자가 복사 / 붙여넣기로
  활성화. 도구가 시스템 파일 (`~/.config/systemd/user/...` / `~/Library/
LaunchAgents/...`) 을 직접 만들지 않음. token-weather 의 "로컬 only" 약속
  표면적 최소화.
- 페어링 daemon 은 1회용 — allowlist 없이 `/pair <code>` 만 listen, code 일치
  시 즉시 종료. createBotServer 의 single-instance lock 과 다른 lifecycle.
- 모든 외부 의존성 (fetch / readline / Bot / fs / execSync / platform) 옵션
  주입 — 단위 테스트가 외부 네트워크 / 실 파일 / 실 bot 없이 e2e 시나리오 검증.

**기존 패키지 변경**:

- 없음 — Phase 3 의 `run-cli` 분기 + 8 deps 가 그대로 통과. Phase 4 의 추가
  deps (`resolveAgentConfigPath`) 도 Phase 3 에서 이미 주입.

**SCHEMA_VERSION** 무변경 — status --json contract 무영향. **Migration** 없음.

**다음 phase**: Phase 5 (#130) — docs/telegram-bot.md / README / SECURITY 갱신

- release publish.
