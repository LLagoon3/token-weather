# Telegram 봇 통합

`@token-weather/telegram` 패키지는 token-weather 의 `status` / `usage` / `doctor` / `auth list` 명령을 Telegram 채팅으로 원격 호출하는 long-poll daemon 을 제공합니다. 로컬에서 봇을 띄우면 핸드폰 / 다른 데스크탑에서 봇에게 명령을 보내 즉시 응답을 받을 수 있습니다.

> **신뢰 모델 요약**: 봇 토큰 / OAuth 토큰은 **로컬 파일에만 저장** 됩니다. 다만 사용량 / 계정 label / 명령 응답 본문은 Telegram 서버를 경유합니다. 자세한 보안 모델은 [§보안 모델](#보안-모델) 참고.

## 빠른 시작

```bash
# 1) 패키지 설치 — cli + telegram 둘 다 필요
npm install -g @token-weather/cli @token-weather/telegram

# 2) BotFather 에서 봇 생성 → token 발급
#    https://core.telegram.org/bots#how-do-i-create-a-bot
#    /newbot → 이름 + username 선택 → 토큰 복사

# 3) 봇 토큰 + chat 페어링 + config 저장 + OS service 자동 등록 / 안내까지 한 명령으로
token-weather telegram setup
#    토큰 prompt → getMe 검증 → 출력의 deep link 클릭 → (Start 버튼) → 페어링 완료
#    → "자동으로 설치하시겠습니까? [Y/n]" → Enter → systemd / launchd / Task Scheduler 자동 등록

# 4) (선택) 진단
token-weather telegram check

# 5) 수동 실행 (OS service 안 쓸 때)
token-weather telegram start

# 6) 제거 (자동 등록 해제)
token-weather telegram uninstall-service
```

## 명령

| 명령                                                 | 설명                                                                                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token-weather telegram setup`                       | 봇 토큰 입력 → `getMe` 검증 → **deep link 클릭** 또는 `/pair <code>` 수동 입력 → config 저장 (chmod 600) → **OS service 자동 등록 [Y/n]** (거부 시 수동 안내 fallback) |
| `token-weather telegram start`                       | long-poll daemon foreground 실행. Ctrl+C 종료                                                                                                                          |
| `token-weather telegram check`                       | config / token / chmod / linger 상태 read-only 진단                                                                                                                    |
| `token-weather telegram uninstall-service`           | `setup` 으로 등록된 OS service 제거 (config / auth.json 은 유지)                                                                                                       |
| `... telegram --help`<br>`... telegram <sub> --help` | 각 명령의 안내 출력                                                                                                                                                    |

## 봇이 받는 채팅 명령

| Telegram 명령    | 동작 (`token-weather <cmd>` 와 동일)                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/status`        | 모바일 폭 친화 compact 평문 (HTML `<pre>` 블록, ≤ 32 column, progress bar 포함)                                       |
| `/status --json` | `formatStatusJson` 결과 (top-level `command` = "status")                                                              |
| `/usage`         | status alias — 모바일 친화 compact 평문                                                                               |
| `/usage --json`  | `formatStatusJson` 결과 (top-level `command` = "usage")                                                               |
| `/doctor`        | `runDoctorRoot` 기본 출력. 인자 / subcommand 차단                                                                     |
| `/auth_list`     | 모든 provider 의 저장 계정 + claude import 섹션                                                                       |
| `/help`          | 사용 가능한 명령 목록을 plain text 로 안내 (issue #148)                                                               |
| `/start <code>`  | 페어링 전용 (setup 시점에만 의미). Telegram deep link 클릭 → 봇 대화창 → (처음이면 Start 버튼) → `/start <code>` 전달 |
| `/pair <code>`   | 페어링 전용 (setup 시점에만 의미). 수동 입력 fallback                                                                 |

본인이 아닌 봇을 mention 한 명령 (`/status@OtherBot`) 은 silent ignore — group chat 에서 다른 봇 명령에 token-weather 가 응답하지 않습니다.

### 자동완성 메뉴 (issue #148)

`token-weather telegram start` daemon 부팅 시 [Bot API `setMyCommands`](https://core.telegram.org/bots/api#setmycommands) 를 호출해 위 명령 목록을 봇에 등록합니다. 사용자는 텔레그램 채팅 입력창에서 `/` 만 눌러도 client (모바일 / 데스크탑) 가 자동완성 메뉴로 명령을 띄워줍니다.

- 등록 source: `packages/telegram/src/bot-commands.js` 의 `BOT_COMMANDS` 배열. 새 명령을 추가할 때는 핸들러 모듈 / `buildDispatcher()` 키 / 본 배열 entry **세 곳을 함께 갱신** — dispatcher 는 본 배열에서 자동 생성되지 않습니다. dispatcher 키 집합과 `BOT_COMMANDS.command` 의 동기화는 단위 테스트가 drift 가드로 잡습니다.
- 등록 실패 (네트워크 / 권한 등) 해도 daemon boot 자체는 계속 — 메뉴 등록은 보조 기능이고 사용자가 명령을 직접 입력하면 동일하게 동작합니다.
- 등록은 idempotent — daemon 재시작마다 자동 갱신.

수동 등록 (자동 등록을 끄거나 별도 봇 username 으로 미리 설정하고 싶을 때) 은 [@BotFather](https://t.me/BotFather) 에 `/setcommands` 명령으로도 가능합니다.

### `/status` / `/usage` 출력 예시 (issue #144, #146)

CLI 의 데스크탑 박스 (`╭─` / `│` / `╰─`) + 50-column heavy rule 은 모바일 폭 (~30–40 column) 에서 wrap 으로 박스가 깨지기 때문에, 텔레그램 봇은 `@token-weather/telegram` 패키지의 `formatStatusForTelegram` 으로 박스 미사용 compact 출력을 보냅니다 (라인 폭 ≤ 32 column 가이드, timezone 표기 생략).

#146 으로 window 라인에 10-column ASCII progress bar (1/8 정밀도 fractional block `█▏▎▍▌▋▊▉` + light shade `░`) 가 복원되었습니다 — ANSI 컬러는 Telegram `<pre>` 가 미지원이라 적용하지 않습니다.

```
━━ Status ━━
Codex  enabled
Claude enabled
Sync   disabled

━━ Codex ━━
me@example.com · Pro
✓ OK (200)
· primary   ███▊░░░░░░  38%
  reset 9:42pm
· secondary ███████▏░░  71%
  reset Sat 4:42am

━━ Claude ━━
me@anthropic.example
✓ OK (200)
· 5h        █▉░░░░░░░░  19%
  reset 3pm
· 7d        ▊░░░░░░░░░   8%
  reset May 22 3am
```

라인 폭은 `· ` (2) + label `padEnd(9)` + space + bar (10) + space + pct `padStart(4)` = **27 자** 로, 32 column 가이드 안에 들어갑니다. `usedPercent` 가 null/NaN 이면 bar 는 10× `░` 로 채우고 pct 는 `—` 로 표기합니다.

CLI 평문 (`token-weather status` 데스크탑) 과 `--json` 출력 contract 는 변경 없이 유지됩니다 — 텔레그램 채널 전용 가공.

## OS service 등록

`telegram setup` 의 마지막 단계가 **`자동으로 설치하시겠습니까? [Y/n]`** 프롬프트를 표시합니다:

- **Enter / y** (default): token-weather 가 직접 systemd unit / launchd plist / Task Scheduler 항목을 작성 + 활성화 (`systemctl --user enable --now` / `launchctl bootstrap` / `schtasks /Create`). Linux 는 `loginctl enable-linger` 까지 자동 (best-effort).
- **n**: 자동 등록 건너뜀 → 아래 수동 안내 블록을 사용자가 복사 / 붙여넣기.
- **systemd / launchctl / schtasks 미감지** (WSL / Docker container / Alpine OpenRC 등): 자동 skip + 동일한 수동 안내 출력.
- **경로에 공백 / 특수문자 포함** (예: Windows 의 `C:\Program Files\nodejs\node.exe`): 자동 등록 가능 (issue #141). systemd 는 `ExecStart="..."` double-quote, launchd plist 는 XML entity escape (`& < >` → `&amp; &lt; &gt;`), Windows schtasks 는 cmd `\"...\"` 로 각자 정확히 quoting. Windows 표준 Node 설치 환경 등이 그대로 자동 등록 가능.

자동 등록을 나중에 해제하려면 `token-weather telegram uninstall-service`. 책임 범위는 service / linger 까지 (config / auth.json 은 그대로 유지).

### 수동 등록 (자동 등록 거부 / skip 시)

> ⚠ 아래 코드 블록은 **구조 예시** 입니다. `/path/to/node` / `/path/to/token-weather` 같은 placeholder 는 실제 환경에서 다르며, **`telegram setup` 출력의 절대 경로를 그대로 복사** 해 주세요. 경로에 공백 / XML 특수문자가 있어도 setup 출력에는 OS 별 정확한 escape (`"..."` / `&amp;` / `\"...\"`) 가 이미 적용되어 있으니 그대로 복사하면 됩니다 (issue #141).

### Linux (systemd `--user`, sudo 불필요)

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/token-weather-bot.service <<'EOF'
[Unit]
Description=Token Weather Telegram bot
After=network-online.target

[Service]
ExecStart=/path/to/node /path/to/token-weather telegram start
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now token-weather-bot.service
# 로그아웃 후에도 daemon 살아 있게:
loginctl enable-linger "$USER"
```

### macOS (launchd LaunchAgent, sudo 불필요)

`~/Library/LaunchAgents/com.token-weather.bot.plist` 작성 후:

```bash
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.token-weather.bot.plist
# 종료:
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/com.token-weather.bot.plist
```

전체 plist 내용은 `telegram setup` 출력 그대로.

### Windows (Task Scheduler, 관리자 권한 불필요)

```cmd
schtasks /Create /TN "TokenWeatherBot" /SC ONLOGON /RL LIMITED /TR "\"path\to\node.exe\" \"path\to\token-weather\" telegram start"
:: 제거:
schtasks /Delete /TN "TokenWeatherBot" /F
```

## 보안 모델

### 신뢰 경계

- **로컬에 머무는 것** (세 경로로 분리):
  - **OAuth access / refresh / id token** — `~/.config/token-weather/auth.json` 에 저장. auth store 가 mode 0600 으로 write.
  - **Telegram bot token / allowedUserIds** — `~/.config/token-weather/config.json` 의 `channels.telegram` 아래. `telegram setup` 이 chmod 600 을 best-effort 로 적용 (Windows 등 chmod 의미 약한 OS 는 `telegram check` 의 "config 권한" 항목에서 확인 권장).
  - **페어링 코드** — `telegram setup` 중 터미널과 1회용 pairing daemon 메모리에만 존재. config / auth store 에 저장하지 않음.

  세 경로 모두 `SENSITIVE_KEYS` redaction 으로 어떤 출력 (`status --json` / Telegram 응답 / 로그) 에도 노출되지 않습니다.

- **Telegram 서버 경유**: 사용량 숫자 / 계정 label / email / token 만료 시각 / 명령 응답 본문 / 사용자 user_id. README 의 "토큰을 외부 서버로 보내지 않습니다" 약속은 **OAuth 토큰 + Telegram 봇 토큰 한정** — 봇 활성화 시 메타데이터는 Telegram 인프라를 경유합니다.

### 1차 방어막

- `allowedUserIds` allowlist — 봇 토큰이 누설되어도 등록되지 않은 사용자의 명령은 silent ignore. 봇의 존재 / 동작 여부조차 응답하지 않음 (로그에는 부분 마스킹된 user_id 만 남김).
- 단일 인스턴스 lock — 같은 봇 토큰으로 다른 daemon 이 polling 중이면 409 Conflict 감지 + 친절 안내 + 즉시 종료.

### 봇 토큰 누설 시 절차

1. BotFather 에 `/revoke` 로 즉시 토큰 무효화 (또는 `/token` 으로 재발급).
2. `~/.config/token-weather/config.json` 의 `channels.telegram.botToken` 갱신 (또는 `telegram setup` 재실행).
3. `telegram check` 로 새 토큰의 `getMe` 응답 확인.

`allowedUserIds` 자체가 누설된 user_id 인 경우 (가족 / 공유 계정) — 해당 user_id 를 array 에서 제거하고 daemon 재시작.

### Doctor / auth-list 의 표면 축소 의도

- `/doctor` 는 root 호출만 노출 — `--refresh-live` 같이 부수효과 있는 옵션은 차단. 원격 명령으로 의도치 않은 토큰 갱신 시도 등을 방지.
- `/auth_list` 도 provider 필터 / `--help` 무시. account 목록만 노출.

## 한계 / FAQ

### 봇이 응답 안 함

1. daemon 이 살아 있나요? `systemctl --user status token-weather-bot.service` 또는 `ps aux | grep telegram`.
2. `telegram check` 의 `getMe API` 결과가 `✓` 인가요? `✗` 이면 토큰 만료 / revoke 의심.
3. 본인의 Telegram user_id 가 `allowedUserIds` 에 있나요? 다른 사용자 등록은 setup 재실행 (페어링) 또는 config 수동 편집 후 daemon 재시작.

### user_id 와 chat_id 의 차이

token-weather 의 allowlist 는 `ctx.from.id` (사용자 user_id) 기준입니다 — DM / group chat 어디서든 동일 사용자가 명령 가능. `chat.id` (채팅방 id) 기준이 아니므로 group 에 봇을 추가하더라도 그 group 의 다른 사용자는 명령 못 함.

### 4096 자 제한

Telegram 메시지 한도가 4096 자 + HTML escape 후 entity expansion 까지 안전 마진 두고 자동 split. 멀티 어카운트 status 출력이 길면 여러 메시지로 분할됨.

### Webhook 미지원

long-poll 만 지원합니다. public HTTPS endpoint 가 필요한 webhook 은 의도적으로 제외 — 일반 로컬 사용자 환경 (NAT, 동적 IP) 에 비현실적.

## 참고

- 패키지: `@token-weather/telegram` (npm)
- 의존성: `grammy` ^1.42
- 보안 신고: [SECURITY.md](../SECURITY.md)
- 전체 API: `import * as telegram from '@token-weather/telegram'` — pairing helpers / OS service templates / handler factories / dispatcher / subcommand entry / formatters / help texts 가 모두 export. 정확한 목록은 [`packages/telegram/src/index.js`](../packages/telegram/src/index.js).
