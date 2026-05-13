---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

feat(telegram): 페어링을 Telegram deep link 로 단순화 — 5 step → 2 step (issue #137).

5-phase plan (#126~#130) 의 follow-up. Phase 4 (#129) 의 `telegram setup` 페어링은
사용자가 봇을 직접 찾아 `/pair TGW-XXXXXX` 를 손으로 입력하는 5 단계 흐름이었다.

PR #136 review (메시지 #792) 에서 HetrixTools / UptimeRobot 류의 "공식 봇 + 백엔드
페어링" 패턴 (클릭 한 번) 과 비교되었고, token-weather 의 보안 모델 (로컬 only /
공식 봇 없음) 위에서도 **Telegram deep link** (`t.me/<bot>?start=<code>`) 로 사용자
단계를 1 클릭으로 줄일 수 있음을 검토 (메시지 #797). 본 release 가 도입.

**신규 동작** (`@token-weather/telegram`):

- `runPairingBot` 의 message:text 핸들러가 `/pair <code>` 외에 `/start <code>` 도
  페어링 명령으로 인식 (regex `^\/(pair|start)\s+(\S+)`). Telegram deep link 클릭
  시 자동 전송되는 `/start` 명령을 페어링 전용으로 해석. backward-compat — 기존
  `/pair` 흐름 그대로.
- `runSetupSubcommand` 의 페어링 안내 출력이 두 경로 모두 표시:
  - (A) deep link URL — `https://t.me/${botInfo.username}?start=${code}`. 클릭 시
    Telegram 앱 자동 열림 + `/start <code>` 자동 전송 → 페어링 완료.
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
니처 그대로, 출력 내용만 확장.
