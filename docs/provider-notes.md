# Provider 메모

## OpenAI Codex

- Endpoint: `https://chatgpt.com/backend-api/wham/usage`
- 인증: OAuth bearer token (`Authorization: Bearer <accessToken>`)
- 선택 헤더: `ChatGPT-Account-Id` (다중 계정 구분용)
- 상태: **실작동 검증 완료** (live 200 OK 확인)

### auth 흐름

- 기본: localhost callback OAuth (`http://localhost:<port>/auth/callback`)
  - PKCE S256 / state 검증 포함
  - 포트 충돌 시 자동 fallback (최대 3회) → manual paste 전환
- fallback: `--manual` 플래그로 callback URL / code 직접 붙여넣기
- token exchange: `--live-exchange` 플래그로 실 endpoint POST
- auth store 우선순위: `agent-store > openclaw-import`

### OAuth endpoints

- authorize: `https://auth.openai.com/oauth/authorize`
- token: `https://auth.openai.com/oauth/token`
- callback: `http://localhost:1455/auth/callback`
- client_id: `app_EMoamEEZ73f0CkXaXp7hrann` (observed, 공식 확정 아님)
- extra authorize params: `id_token_add_organizations=true`, `codex_cli_simplified_flow=true`, `originator=pi`

### 알려진 제한

- `auth logout`은 로컬 store 제거만 수행 (provider revoke endpoint 미호출)
- 네트워크 호출에 timeout/AbortController 없음 → 이슈 #7
- client_secret 요구 여부 미확정

---

## Anthropic / Claude

### auth 흐름

두 경로가 공존한다.

- `auth login claude --live-exchange`: 독립 OAuth (브라우저 로그인) → agent-store에 live token 저장
- `auth import claude`: `~/.claude/.credentials.json` reader → agent-store에 복사

credential source 우선순위: `agent-store > claude-cli-import`

### live usage endpoint

- `GET https://api.anthropic.com/api/oauth/usage`
- 헤더: `Authorization: Bearer <token>`, `anthropic-version: 2023-06-01`, `anthropic-beta: oauth-2025-04-20`
- 상태: **실작동 검증 완료** (live 200 OK, 사용률 수치 반환)
- 응답 shape (observed):
  - `five_hour: { utilization, resets_at }` — 5시간 window
  - `seven_day: { utilization, resets_at }` — 주간 window
  - `seven_day_sonnet / seven_day_opus: { utilization }` — 모델별 주간

### OAuth endpoints (observed — Claude Code v2.1.107 바이너리에서 추출)

- authorize: `https://claude.com/cai/oauth/authorize` (claude.ai 사용자 OAuth)
- token: `https://platform.claude.com/v1/oauth/token`
- redirect_uri: `http://localhost:<port>/callback` (Codex와 경로 다름)
- manual redirect: `https://platform.claude.com/oauth/code/callback`
- success page: `https://platform.claude.com/oauth/code/success?app=claude-code`
- client_id: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- scopes: `org:create_api_key user:profile user:inference`

### 관찰 기반 주의사항 (Claude 전용)

- authorize URL에 `code=true` 파라미터를 추가로 보낸다 (OAuth 스펙 외 확장)
- token endpoint는 **JSON body**를 요구. form-urlencoded는 Claude API 에러(`invalid_request_error`) 응답
- `authorization_code` grant는 body에 `state` 필드를 포함해야 함
- `https://platform.claude.com/oauth/authorize`는 API key 발급용 별도 흐름 → claude.ai 경로와 혼동 금지

### credential 파일 (claude-cli-import)

- 경로: `~/.claude/.credentials.json`
- 구조: `{ claudeAiOauth: { accessToken, refreshToken, expiresAt, scopes, subscriptionType, rateLimitTier } }`

### refresh token

- `refreshClaudeToken` 구현 (Codex와 동일한 `allowLiveExchange` guard)
- `doctor claude --refresh-live`로 수동 검증 가능
- rotation 반영: 응답에 새 `refresh_token`이 오면 교체, 없으면 기존 유지

### 로컬 usage (stats-cache)

- 파일: `~/.claude/stats-cache.json`
- Claude Code가 실행될 때 자동 갱신
- 구조:
  ```json
  {
    "version": 3,
    "totalSessions": 42,
    "totalMessages": 1200,
    "modelUsage": { "claude-opus-4-6": 10 },
    "dailyModelTokens": {
      "2026-04-14": {
        "claude-opus-4-6": {
          "inputTokens": 5000,
          "outputTokens": 2000,
          "cacheCreation": 300,
          "cacheRead": 1500
        }
      }
    }
  }
  ```
- 상태: 감지 및 최소 파싱 완료 (totalSessions, totalMessages, modelUsage/dailyModelTokens 유무)
- 상세 토큰 수치 파싱은 후속 작업

### 알려진 제한 / 미확정

- client_secret 요구 여부 (현재 public client로 가정)
- refresh token rotation 정책 상세
- 네트워크 호출 timeout/AbortController 미적용 (이슈 #7)
- web session cookie fallback은 미구현 (이슈 #14)
