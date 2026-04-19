# 아키텍처

Codebase 상세 규칙은 `docs/codebase-guide.md`. 본 문서는 고수준 구성만.

## 요약

로컬 CLI agent 중심 구조. 외부 auth store(OpenClaw 등) 의존 없이 독립적으로 인증, 토큰 저장·갱신·사용량 조회를 수행한다.

```
[ai-usage-agent CLI]
  ├─ Auth Commands (login / list / logout / import)
  ├─ Auth Broker (OAuth localhost callback, manual paste fallback, PKCE S256)
  ├─ Credential Store (auth.json, 0600)
  ├─ Provider Registry (services/provider-registry.js)
  │   ├─ Codex provider
  │   └─ Claude provider
  ├─ Provider Adapters (packages/provider-adapters/src/{codex,claude})
  │   └─ 공통 OAuth 헬퍼 (packages/provider-adapters/src/shared/)
  └─ Schemas (packages/schemas — usage snapshot / event JSON Schema)
```

## 주요 구성 요소

### CLI Agent (`packages/agent`)

- `status`, `usage`, `doctor`, `config init`
- `auth login/list/logout/import`
- multi-account 지원
  - 한 provider에 여러 real 계정 저장/조회 (status는 기본적으로 병렬 전체 조회)
  - `auth login --label <name>`로 사용자 친화적 라벨 부여
  - `status --account <email|accountKey|label>`로 필터
  - `config.json defaults.profiles.{provider}`로 기본 필터 지정
- login-runner(`cli/login-runner.js`)로 provider별 OAuth 흐름 공통화

### Services (`packages/agent/src/services`)

- `status-service.js` — config 로드 + provider registry 순회
- `provider-registry.js` — PROVIDER_REGISTRY 배열로 provider 등록
- `{provider}-provider.js` — 각 provider의 snapshot 빌더

새 provider를 추가할 때는 `codebase-guide.md §11` 체크리스트 참고.

### Provider Adapters (`packages/provider-adapters`)

- `shared/` — provider 중립 OAuth 헬퍼
  - `buildOAuthAuthorizationUrl` — authorize URL 조립
  - `postToTokenEndpoint` — token endpoint POST (form/json, timeout, error 정규화)
  - `fetchWithTimeout` — AbortController 기반 공통 wrapper
  - `liveExchangeDisabledError` — guard용 표준 에러
- `codex/` — Codex (OpenAI) 인증 + usage
- `claude/` — Claude (Anthropic) 인증 + usage + stats-cache

각 provider는 동일한 파일 구성 패턴을 따른다 (constants / build-authorization-url / exchange-code / refresh-token / fetch-usage). 상세는 `docs/codebase-guide.md §3`.

### Schemas (`packages/schemas`)

- `usage-snapshot.schema.json`
- `usage-event.schema.json`
- 핵심 필드: `source`, `authType`, `confidence`, `usageWindows`, `status.bucket`
- `validateUsageSnapshot` / `validateUsageEvent` — zero-dep 런타임 validator
- `buildUsageSnapshot` 출구에서 자동 validation (soft enforcement — invalid 시 warn + confidence 하강)

### 인증 계층

- 기본: localhost callback OAuth (PKCE S256)
- fallback: manual paste (Codex만)
- import: `auth import openclaw` (Codex) / `auth import claude` (Claude)
- 후순위: device code (미구현)
- credential source 우선순위: `agent-store` > `{provider}-cli-import` 또는 `openclaw-import`

상세: `docs/auth-architecture.md`, `docs/auth-cli.md`.

## 확장 가능성

- 백엔드 API: 정규화 이벤트 수집, provider 직접 poll, 상태 집계
- 웹 대시보드: overview, provider/account 상세, timeline
- keychain 연동
- 추가 provider (예: Gemini, Perplexity 등) — `codebase-guide.md §11` 따라 추가
