# 보안 정책

🌐 [English](./SECURITY.md) · **한국어**

> 이 파일이 한글 원본입니다. 영문 번역본 ([SECURITY.md](./SECURITY.md)) 은 본 파일을 따라 갱신됩니다. i18n drift 정책은 [CONTRIBUTING.md §10](./CONTRIBUTING.md) 참고.

이 도구는 OAuth access token / refresh token / id token 같은 자격증명을 로컬에서 다룹니다. 보안 이슈는 공개 이슈 트래커가 아닌 비공개 채널로 신고해 주세요.

## 지원 버전

| Version | Supported |
| ------- | --------- |
| `0.1.x` | ✅        |
| 그 이전 | ❌        |

## 비공개 신고 채널

GitHub Security Advisory를 통해 비공개로 신고해 주세요.

- 신고 페이지: https://github.com/LLagoon3/token-weather/security/advisories/new
- 평균 응답 SLA: 영업일 기준 5일 이내 1차 답변
- 심각도가 높은 경우(원격 토큰 유출, 자격증명 노출 등) 우선 대응

## 토큰을 실수로 공개 위치에 첨부했을 때

GitHub Issue / PR / 외부 채널(Slack, 이메일 본문 등)에 access token, refresh token, id token, session cookie, account key가 그대로 들어간 경우:

1. 즉시 해당 위치에서 토큰을 삭제(또는 issue/PR을 비공개로 전환)합니다.
2. 해당 자격증명을 즉시 **revoke** 합니다.
   - Codex (OpenAI): https://platform.openai.com/account/api-keys 또는 chatgpt.com 세션 로그아웃
   - Claude (Anthropic): https://console.anthropic.com 또는 Claude CLI 재로그인
3. `token-weather auth logout <provider>`로 로컬 store에서도 제거 후 재로그인합니다.

토큰 복구 / 자동 revoke 기능은 제공하지 않습니다 (provider revoke endpoint 미통합 상태).

## 새 토큰성 필드를 추가할 때 (메인테이너 / 기여자용)

`status --json` 출력은 토큰 키 blacklist 기반 redaction을 적용합니다 (`docs/cli-json-output.md` §한계 참고). 새 토큰 필드를 provider adapter / auth schema에 추가하는 PR에서는 다음을 함께 수행해야 합니다.

- `packages/agent/src/cli/status-json.js::SENSITIVE_KEYS`에 새 키 등록
- `--json` 출력 회귀 테스트(가짜 토큰 주입 → JSON에 누출 없음 검증) 추가

이 절차를 빠뜨리면 외부 소비자에게 그대로 노출될 수 있습니다.

## Telegram 봇 통합의 위협 모델 (`@token-weather/telegram` 사용 시)

옵션 패키지 `@token-weather/telegram` 을 활성화하면 token-weather 의 신뢰 경계가 확장됩니다. 활성화 전에 다음을 확인해 주세요. 상세 보안 모델은 [docs/telegram-bot.md §보안 모델](./docs/telegram-bot.md#보안-모델).

### 신뢰 경계

- **로컬 only** (저장 위치 별로 분리):
  - OAuth access / refresh / id token: `~/.config/token-weather/auth.json` 에 저장. auth store 가 mode 0600 으로 write.
  - Telegram bot token / allowedUserIds: `~/.config/token-weather/config.json` 의 `channels.telegram` 아래에 저장. `telegram setup` 이 chmod 600 을 best-effort 로 적용.
  - 페어링 코드: setup 중 터미널 + 1회용 pairing daemon 메모리에만 존재. config / auth store 에 저장하지 않음.

  세 경로 모두 `SENSITIVE_KEYS` redaction 으로 어떤 출력에도 노출되지 않음.

- **Telegram 서버 경유 (신규)**: 사용량 숫자 / 계정 label / email / 명령 응답 본문 / 사용자 user_id. 봇 활성화 시 README 의 "로컬 only" 약속은 **OAuth 토큰 + 봇 토큰 한정** 으로 정밀화됨.

### 봇 토큰 / 채널 단의 1차 방어막

- `channels.telegram.allowedUserIds` allowlist — 등록되지 않은 user_id 의 메시지는 silent ignore (응답 / 로그 마스킹). 봇 토큰이 누설되어도 명령 표면이 즉시 열리지 않음.
- 단일 인스턴스 lock — 같은 봇 토큰으로 다른 daemon 이 polling 중이면 409 Conflict 감지 후 종료. 의도치 않은 두 번째 daemon 실수 회피.
- 노출 명령 표면 축소 — `/doctor` 는 root 호출만, `/auth_list` 도 인자 차단. 원격 명령으로 부수효과 있는 호출 (token refresh-live 등) 트리거 불가.

### 봇 토큰 누설 시 절차

1. BotFather (`@BotFather`) 에 `/revoke` → 즉시 토큰 무효화 (또는 `/token` 으로 재발급).
2. 로컬 `config.channels.telegram.botToken` 갱신 — `token-weather telegram setup` 재실행이 가장 안전.
3. `token-weather telegram check` 로 `getMe API` 가 새 토큰으로 `✓` 응답하는지 확인.
4. `~/.config/token-weather/config.json` 의 권한이 `chmod 600` 인지 확인 — `telegram check` 의 "config 권한" 항목.

### 추가 신고 시나리오

- 본인이 아닌 user_id 가 `allowedUserIds` 에 추가됨을 발견 → 즉시 array 에서 제거 + daemon 재시작 (`systemctl --user restart token-weather-bot.service` 또는 stop → start).
- 봇이 본인 명령에 응답하지 않는데 다른 사용자에게는 응답함 → 봇 토큰 또는 allowlist 조작 의심. BotFather 토큰 revoke + 신고.
- daemon 로그에 본인 user_id 가 아닌 마스킹된 id (`xxx****yy`) 가 `미허용 user_id 거부` 로 반복 등장 → 봇 토큰이 외부에 알려진 정황. 토큰 revoke 권장.
