# ai-usage-agent

여러 AI 서비스의 사용량과 인증 상태를 로컬에서 관리하는 CLI agent + provider adapter + schema 패키지 모음.

## 현재 구현 범위

이 repo의 핵심은 로컬에서 동작하는 CLI agent와 그 구성 패키지이다.

- **`packages/agent`** — CLI 에이전트. `status`, `usage`, `doctor`, `config init`, `auth login/list/logout` 명령 제공
- **`packages/provider-adapters`** — provider별 인증/endpoint 연결 및 usage 정규화
- **`packages/schemas`** — 공통 데이터 계약 (usage snapshot, usage event JSON Schema)

### 현재 동작하는 것

- Codex OAuth 독립 인증 (localhost callback + PKCE S256)
- `--manual` paste fallback
- `--live-exchange` 실제 token exchange 및 저장
- refresh token 재발급 및 rotation 반영
- agent-store 기반 real token으로 usage 조회
- id_token/access_token JWT claims 기반 계정 식별
- multi-account resolver (`lastUsedAt` 자동 선택 + `--account` override)
- `auth list`, `auth logout` 명령
- `doctor`, `doctor codex`, `doctor codex --refresh-live` 명령

### 아직 구현되지 않은 것

- Claude provider 인증 및 usage 조회
- device code fallback
- keychain 연동

## 에이전트 실행

```bash
npm run agent:status
npm run agent:usage
npm run agent:doctor
npm run agent:config:init
```

## 프로젝트 구조

```text
packages/
  agent/             # CLI 에이전트
  provider-adapters/ # provider별 인증/usage 어댑터
  schemas/           # 공통 JSON Schema
docs/                # 아키텍처, 인증, provider 문서
scripts/
  poc/
```

## 확인된 endpoint

- Codex: `https://chatgpt.com/backend-api/wham/usage`
- Claude OAuth: `https://api.anthropic.com/api/oauth/usage`
- Claude web fallback:
  - `https://claude.ai/api/organizations`
  - `https://claude.ai/api/organizations/{orgId}/usage`

## 공통 스키마

`packages/schemas`에 JSON Schema 정의:

- `usage-snapshot.schema.json`
- `usage-event.schema.json`
- 핵심 필드: `source`, `authType`, `confidence`, `usageWindows`, `status.bucket` / `reason.bucket`

## 상태 버킷

- `ok` / `rate_limit` / `usage_window` / `billing` / `auth` / `overloaded` / `unknown`

## 보안 원칙

- refresh token / session cookie / sessionKey는 서버에 저장하지 않음
- raw prompt / raw response / 전체 transcript 업로드 금지
- callback 서버는 `127.0.0.1`에만 bind
- access token / refresh token 로그 출력 금지

## 인증 독립화

agent는 OpenClaw auth store에 의존하지 않고 자체 auth broker를 갖는다.

- 기본: localhost callback OAuth
- fallback: manual paste
- 후순위: device code (미구현)
- credential source 우선순위: `agent-store` > `openclaw-import`

상세는 `docs/auth-architecture.md` 참조.

## Codex OAuth 검증 현황

- authorize/token endpoint, callback URL, PKCE S256: 검증 완료
- token exchange, refresh, usage 조회: 동작 확인
- `client_id`는 관찰값 — 공식 확정 아님
- `client_secret` 요구 여부, refresh rotation 정책: 미확정

## 작업 / 협업 규칙

- 브랜치 흐름: `작업 브랜치 -> dev -> main`
- 커밋 형식: `type(scope): 한글 설명`
- PR 제목 형식: `[feat] 한글 요약`

## 다음 작업

1. agent-store 기반 real token으로 usage 조회 연결 점검
2. Claude 인증 경로 확장
3. `auth import openclaw` 경로 정리

## 라이선스

추후 결정
