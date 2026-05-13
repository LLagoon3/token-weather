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

- `config.channels.telegram = { enabled: false, botToken: '', allowedChatIds: [] }`
  신규. `providers` (usage 조회 대상 — codex / claude) 와 의도적으로 분리 —
  PROVIDER_REGISTRY / `--provider` 필터 / `status --json providers[]` / `authSource`
  / `usageSnapshots` 가 모두 usage provider 의미에 묶여 있어, Telegram 같은
  transport / channel 은 별도 네임스페이스 (PR #131 review 반영).
- `SENSITIVE_KEYS` 확장: `botToken` / `bot_token` / `telegramBotToken` —
  Phase 2 이후 raw 영역에 흘러갈 가능성 대비 redaction 가드 선 등록.
- redaction 회귀 테스트 2건 신설 (`channels.telegram` 경로 fixture).

**SCHEMA_VERSION** 무변경 — `status --json` contract 는 무영향 (telegram 키는
별도 패키지가 단독 소비). **Migration** 없음 — 기존 사용자 동작 100% 호환.
