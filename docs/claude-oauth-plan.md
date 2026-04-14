# Claude OAuth + usage 기능 개발 계획

Codex OAuth(OpenClaw 참고) 구조를 기반으로 Claude 쪽에도 동등한 auth + usage 체계를 구축한다.
본 문서는 feat/claude-oauth-foundation 브랜치의 작업 단위와 우선순위를 정의한다.

## 배경 / 확인된 사실

1. Claude Code는 `~/.claude/.credentials.json`에 OAuth token을 저장한다.
   - 구조: `claudeAiOauth: { accessToken, refreshToken, expiresAt, scopes, subscriptionType, rateLimitTier }`

2. 검증된 usage endpoint:
   ```
   GET https://api.anthropic.com/api/oauth/usage
   Authorization: Bearer <accessToken>
   anthropic-version: 2023-06-01
   anthropic-beta: oauth-2025-04-20
   ```

3. Web fallback:
   - `GET https://claude.ai/api/organizations`
   - `GET https://claude.ai/api/organizations/{orgId}/usage`
   - `Cookie: sessionKey=<claude.ai session>`

4. 현재 구현 범위:
   - credential import (`auth import claude`)
   - status/auth list/doctor에서 계정 노출
   - stats-cache.json 기반 로컬 usage 파싱 (최소 필드)

5. 아직 없는 것:
   - 실제 네트워크 호출 (usage endpoint, token endpoint 모두)
   - 독립 OAuth code flow
   - refresh 경로

## Phase 1 — live usage 호출 (저위험, 즉시 가치)

### 목표
기존 CLI-import 토큰으로 `api.anthropic.com/api/oauth/usage`를 호출하여
실시간 사용량 수치를 snapshot으로 노출한다.

### 선택 근거
토큰은 이미 `~/.claude/.credentials.json`에 존재하므로 OAuth flow 없이도
live 데이터가 확보된다. stats-cache와 비교 검증도 가능하다.

### 구현 범위
- `packages/provider-adapters/src/claude/fetch-claude-usage.js`
  - Codex의 `fetchCodexUsage` 구조와 맞춤
  - `SCHEMA_VERSION` 기반 공통 snapshot 반환
  - fetchImpl 주입 가능 (테스트용)
- `status-service.js`의 Claude snapshot에 `networkUsage` 필드 추가
  - 기존 stats-cache 기반 `usage` 필드는 유지
  - live 우선, 실패 시 stats-cache fallback 가능하도록 구조화
- CLI에서 live usage 노출 (`status`, `doctor claude`)
- 테스트: mock fetchImpl로 snapshot 정규화 검증

### 완료 조건
- 실제 Claude CLI 토큰으로 200 OK 응답을 받아 snapshot 변환 확인
- 네트워크 실패 시에도 전체 status가 깨지지 않음 (per-provider isolation)
- Unit test로 성공/실패 snapshot 변환 검증

### 영향 범위
- `packages/provider-adapters`
- `packages/agent`

---

## Phase 2 — refresh token 재발급 (안정성)

### 목표
`accessToken` 만료 시 `refreshToken`으로 재발급하여 장기 운영 안정성을 확보한다.

### 미해결 항목
- Claude OAuth token endpoint URL (공식 문서 없음)
  - Claude CLI 바이너리 / OpenClaw 코드에서 관찰 필요
- client_id 관찰값 확인

### 조사 단계 (구현 전)
- `~/.local/share/claude/versions/<v>` 바이너리 strings 추출
  - `oauth/token`, `client_id`, `token_endpoint` 후보
- OpenClaw `dist/*.js`에서 Claude OAuth refresh 흔적 탐색

### 구현 범위
- `refresh-claude-token.js` (Codex 패턴 모방, `allowLiveExchange` guard 포함)
- `doctor claude --refresh-live` 커맨드
- 성공 시 store 갱신 (rotation 대응)

### 완료 조건
- refresh 호출이 성공적으로 새 토큰 반환
- store가 올바르게 갱신됨 (rotation 시 기존 refreshToken 교체)
- 실패 시 기존 store 유지 + 에러 메시지 명확

### 영향 범위
- `packages/provider-adapters`
- `packages/agent`

---

## Phase 3 — 독립 OAuth flow (ambitious, 후순위)

### 목표
Claude CLI 의존 없이 직접 OAuth authorization code flow로 로그인한다.

### 구현 범위 (Codex 패턴 동일)
- `build-claude-authorization-url.js`
- `exchange-claude-authorization-code.js` (`allowLiveExchange` guard)
- `claude-auth-constants.js` (authorize/token endpoint, client_id, scopes)
- `auth login claude` 커맨드 (기존 `localhost-callback.js` 재사용)

### 미해결 항목
- Claude authorize endpoint URL
- Claude OAuth 허용 client_id
- PKCE 정책 (S256 지원 여부)
- 허용 redirect_uri 포트/호스트 제약

### 완료 조건
- 브라우저에서 실제 로그인 후 localhost callback으로 code 수신
- live token exchange 성공 및 store 저장
- 독립 토큰으로 usage endpoint 200 OK 확인

### 영향 범위
- `packages/provider-adapters`
- `packages/agent`

---

## Phase 4 — web session fallback (옵션)

### 목표
OAuth 토큰이 없거나 실패할 때 `claude.ai` session cookie로 usage 조회.

### 우선순위
낮음. OAuth 경로가 안정화되면 굳이 필요한지 재평가 후 결정한다.
세션 키 관리 보안 이슈가 있으므로 신중히 접근.

### 구현 시 고려
- cookie 입력 UX (CLI paste? file? env?)
- 세션 만료 처리
- organizations endpoint로 orgId 자동 획득

### 영향 범위
- `packages/provider-adapters`
- `packages/agent`

---

## 실행 순서

1. Phase 1만 먼저 PR → merge
2. Phase 2 조사 → 구현 → PR
3. Phase 3 조사 → 구현 → PR
4. Phase 4는 별도 판단

각 Phase는 별도 GitHub 이슈로 추적한다.

## 참고

- Codex auth 구현 (`packages/provider-adapters/src/codex/`, `packages/agent/src/auth/`)
- `docs/provider-notes.md` — Claude/Codex provider 메모
- `docs/auth-architecture.md` — 전체 auth 아키텍처
