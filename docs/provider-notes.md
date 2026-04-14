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
  - `client_id`는 observed 값 기반 (공식 확정 아님)
- auth store 우선순위: `agent-store > openclaw-import`

### 알려진 제한

- `auth logout`은 로컬 store 제거만 수행 (provider revoke endpoint 미호출)
- 네트워크 호출에 timeout/AbortController 없음 → `#7` 참고

---

## Anthropic / Claude

### 인증 (local import)

- credential 파일: `~/.claude/.credentials.json`
- 구조: `{ claudeAiOauth: { accessToken, refreshToken, expiresAt, scopes, subscriptionType, rateLimitTier } }`
- 상태: **local credential reuse 검증 완료**
- `auth import claude`로 agent-store에 저장 가능
- 독립 OAuth 재구현은 미완료 (후순위)

### usage (로컬 stats-cache)

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
- 상태: **감지 및 최소 파싱 완료** (totalSessions, totalMessages, modelUsage/dailyModelTokens 유무)
- 상세 토큰 수치 파싱은 다음 단계

### 알려진 제한

- 네트워크 기반 usage API (`/api/oauth/usage` 등) 실호출 검증 미완료
- stats-cache는 로컬 캐시 — 실시간 서버 데이터와 다를 수 있음
