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

# 3) 봇 토큰 + chat 페어링 + config 저장 + OS service 안내까지 한 명령으로
token-weather telegram setup
#    토큰 prompt → getMe 검증 → 출력의 deep link 클릭 (또는 /pair 수동 입력) → 봇 대화창 열림 → (필요 시 Start 버튼 클릭) → 페어링 완료

# 4) (선택) OS service 등록 — setup 끝에서 안내한 블록을 복사 / 붙여넣기

# 5) (선택) 진단
token-weather telegram check

# 6) 수동 실행 (OS service 안 쓸 때)
token-weather telegram start
```

## 명령

| 명령                                                 | 설명                                                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `token-weather telegram setup`                       | 봇 토큰 입력 → `getMe` 검증 → **deep link 클릭** 또는 `/pair <code>` 수동 입력으로 페어링 → config 저장 (chmod 600) → OS service template print |
| `token-weather telegram start`                       | long-poll daemon foreground 실행. Ctrl+C 종료                                                                                                   |
| `token-weather telegram check`                       | config / token / chmod / linger 상태 read-only 진단                                                                                             |
| `... telegram --help`<br>`... telegram <sub> --help` | 각 명령의 안내 출력                                                                                                                             |

## 봇이 받는 채팅 명령

| Telegram 명령    | 동작 (`token-weather <cmd>` 와 동일)                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/status`        | 평문 status 출력 (HTML `<pre>` 블록)                                                                                  |
| `/status --json` | `formatStatusJson` 결과 (top-level `command` = "status")                                                              |
| `/usage`         | status alias — 평문                                                                                                   |
| `/usage --json`  | `formatStatusJson` 결과 (top-level `command` = "usage")                                                               |
| `/doctor`        | `runDoctorRoot` 기본 출력. 인자 / subcommand 차단                                                                     |
| `/auth_list`     | 모든 provider 의 저장 계정 + claude import 섹션                                                                       |
| `/start <code>`  | 페어링 전용 (setup 시점에만 의미). Telegram deep link 클릭 → 봇 대화창 → (처음이면 Start 버튼) → `/start <code>` 전달 |
| `/pair <code>`   | 페어링 전용 (setup 시점에만 의미). 수동 입력 fallback                                                                 |

본인이 아닌 봇을 mention 한 명령 (`/status@OtherBot`) 은 silent ignore — group chat 에서 다른 봇 명령에 token-weather 가 응답하지 않습니다.

## OS service 수동 등록

`telegram setup` 끝에서 print 되는 명령 블록을 셸에 복사 / 붙여넣기 하면 부팅 후 자동 시작이 활성화됩니다. token-weather 가 시스템 파일을 직접 만들지 **않습니다** — 사용자 동의가 필요한 변경이라는 보안 도구 원칙.

> ⚠ 아래 코드 블록은 **구조 예시** 입니다. `/path/to/node` / `/path/to/token-weather` 같은 placeholder 는 실제 환경에서 다르며, **`telegram setup` 출력의 절대 경로를 그대로 복사** 해 주세요. 경로에 공백 / 특수문자가 있는 경우 setup 출력의 정확한 quoting 을 반드시 따라야 합니다.

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
