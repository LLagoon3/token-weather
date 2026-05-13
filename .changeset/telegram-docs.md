---
'@token-weather/cli': patch
'@token-weather/provider-adapters': patch
'@token-weather/schemas': patch
'@token-weather/telegram': patch
---

docs(telegram): docs/telegram-bot.md 신규 + README / SECURITY / release-policy 갱신 (issue #130).

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
