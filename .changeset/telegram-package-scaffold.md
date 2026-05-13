---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

chore(repo): @token-weather/telegram 워크스페이스 패키지 scaffold (issue #126).

5-phase Telegram 봇 통합 plan (issue #126 ~ #130) 의 Phase 1. 신규 워크스페이스
패키지 신설 + config / redaction 인프라 선 도입으로 후속 phase 의 코어 작업
진입을 단순화. linked 정책에 따라 4 패키지 모두 같은 minor bump.

**신규 워크스페이스 패키지**:

- `@token-weather/telegram` 초기 v0.4.0 진입 (다음 publish 시 linked 정책으로
  4 패키지 모두 v0.5.0 동시 진입).
- placeholder `runTelegramCommand` export — Phase 3 머지 시 실 dispatch
  로직이 채워짐.
- `grammy` ^1.42.0 신규 의존성 — long-poll 루프 / 미들웨어 추상화.

**기존 패키지 변경** (`@token-weather/cli`):

- `config.providers.telegram = { enabled: false, botToken: '', allowedChatIds: [] }` 추가 (codex/claude 동급).
- `SENSITIVE_KEYS` 확장: `botToken` / `bot_token` / `telegramBotToken` —
  Phase 2 이후 raw 영역에 흘러갈 가능성 대비 redaction 가드 선 등록.
- redaction 회귀 테스트 2건 신설.

**SCHEMA_VERSION** 무변경 — status --json contract 는 무영향 (telegram 키는
별도 패키지가 단독 소비). **Migration** 없음 — 기존 사용자 동작 100% 호환.
