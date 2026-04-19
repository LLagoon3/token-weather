# ai-usage-agent

여러 AI 서비스의 사용량과 인증 상태를 로컬에서 관리하는 CLI agent + provider adapter + schema 패키지 모음.

외부 auth store(OpenClaw 등)에 의존하지 않고 자체 auth broker / credential store를 사용한다.

## 빠른 시작

```bash
# 상태 확인 (설정 / provider별 인증 / usage)
npm run agent:status

# usage만 집중해서 보기
npm run agent:usage

# 환경 점검 (credential 경로, token 상태, refresh 가능 여부)
npm run agent:doctor

# 최초 설정 파일 생성
npm run agent:config:init
```

## 현재 지원 범위

### Provider

| Provider | Auth (독립 OAuth) | Auth (credential import) | Usage 조회 | Refresh | Status |
| --- | --- | --- | --- | --- | --- |
| Codex (OpenAI) | ✓ `auth login codex --live-exchange` | `auth import openclaw` | ✓ `wham/usage` live | ✓ `doctor codex --refresh-live` | 운영 중 |
| Claude (Anthropic) | ✓ `auth login claude --live-exchange` | `auth import claude` (CLI 재사용) | ✓ `oauth/usage` live | ✓ `doctor claude --refresh-live` | 운영 중 |

### 검증된 endpoint

- Codex: `https://chatgpt.com/backend-api/wham/usage`
- Claude OAuth: `https://api.anthropic.com/api/oauth/usage`
- Claude web fallback (옵션, 미구현): `https://claude.ai/api/organizations/{orgId}/usage`

### 공통 기능

- PKCE S256 + state 검증 localhost OAuth callback
- multi-account 지원
  - 한 provider에 여러 계정 저장/조회 (한 번의 `status`가 모든 live 계정 병렬 조회)
  - `auth login <provider> --label <name>`으로 계정에 label 부여
  - `status --account <email | accountKey | label>`로 필터
  - `config.json defaults.profiles.{provider}`로 기본 필터 지정
- refresh token rotation 반영
- `--live-exchange` guard (실수로 실제 token 호출이 반복되는 것 방지)
- network 호출 timeout/abort (기본 15초, `fetchWithTimeout`)
- CLI / status-service / provider adapter 3계층 분리

## 패키지 구조

```text
packages/
  agent/               CLI 에이전트 (auth / status / doctor / config 명령)
  provider-adapters/   provider별 인증·usage 로직
    codex/
    claude/
  schemas/             공통 JSON Schema (usage snapshot / event)
docs/                  architecture / auth / provider 문서
scripts/poc/           experimental scripts (저위험 실험)
```

## CLI 커맨드

### status / usage

```bash
ai-usage-agent status
ai-usage-agent usage
ai-usage-agent status --account <email | accountKey | label>  # 특정 계정만
```

provider별 credential 상태, 선택된 계정, live usage window, 로컬 캐시 요약을 출력한다.
한 provider에 여러 계정이 저장되어 있으면 기본은 모두 병렬 조회.

### auth

```bash
ai-usage-agent auth login codex   [--live-exchange] [--port N] [--timeout SEC] [--label NAME] [--manual] [--no-open]
ai-usage-agent auth login claude  [--live-exchange] [--port N] [--timeout SEC] [--label NAME]
ai-usage-agent auth list
ai-usage-agent auth logout <provider> [--account <id>]
ai-usage-agent auth import openclaw    # 기존 OpenClaw auth-profiles 흡수
ai-usage-agent auth import claude      # ~/.claude/.credentials.json 흡수
```

`--live-exchange` 없이 호출하면 mock 저장만 수행한다.
`--label <name>`을 지정하면 저장된 계정에 사용자 친화적 이름이 붙고, 이후 `--account <name>`으로 참조 가능하다.

### doctor

```bash
ai-usage-agent doctor                        # 공통 환경 점검
ai-usage-agent doctor codex                  # Codex 계정·refresh 가능성 점검
ai-usage-agent doctor codex  --refresh-live  # 실제 refresh POST
ai-usage-agent doctor codex  --account <id>
ai-usage-agent doctor claude                 # Claude credential·live usage 점검
ai-usage-agent doctor claude --refresh-live  # 실제 refresh POST
ai-usage-agent doctor claude --refresh-live --account <id>  # 특정 계정 지정
```

### config

```bash
ai-usage-agent config init
```

`~/.config/ai-usage-agent/config.json`에 기본 설정을 생성한다.

## Credential source 우선순위

### Codex
`agent-store` (live-exchange 실토큰) → `openclaw-import` (마이그레이션)

### Claude
`agent-store` (live-exchange 또는 `auth import claude` 저장분) → `claude-cli-import` (`~/.claude/.credentials.json` 실시간 reader)

## 스키마

`packages/schemas`에 JSON Schema 정의 + zero-dep 런타임 validator.

- `usage-snapshot.schema.json`
- `usage-event.schema.json`
- 핵심 필드: `source`, `authType`, `confidence`, `usageWindows`, `status.bucket`
- `status.bucket` 값: `ok` / `rate_limit` / `usage_window` / `billing` / `auth` / `auth_scope` / `overloaded` / `unknown`
- `validateUsageSnapshot(data)` / `validateUsageEvent(data)` — 런타임 검증 함수
- `buildUsageSnapshot` 출구에서 자동 validation (soft enforcement: invalid → warn + confidence 하강)

## 보안 원칙

- callback 서버는 `127.0.0.1`에만 bind
- state 검증 + PKCE S256
- refresh token / session cookie / sessionKey는 외부 서버 업로드 금지
- access/refresh token을 로그에 출력하지 않음
- raw prompt / raw response / 전체 transcript 업로드 금지

## observed vs verified

바이너리 strings / 로컬 JWT에서 관찰한 값들(`client_id`, endpoint 등)은 **observed** 레벨로 구분하고 공식 확정된 값이 아님을 명시한다. provider 측 변경에 대비해 guard(`allowLiveExchange`) 뒤에서만 실 호출이 일어나도록 설계.

자세한 내용은 `docs/auth-architecture.md` 참고.

## 기여자용 참고 문서

- `docs/codebase-guide.md` — 다른 Claude 세션 / 기여자가 구조적 일관성을 유지하며 작업할 수 있도록 정리한 상세 가이드 (패키지 레이아웃, shared/ 헬퍼 사용법, provider adapter 패턴, 네이밍 / 테스트 / 커밋 규칙, anti-patterns, 새 기능 체크리스트).
- `docs/architecture.md` — 고수준 구조 요약.
- `docs/auth-cli.md` — CLI 명령 / 정책.
- `docs/provider-notes.md` — provider별 observed endpoint / client_id.
- `CONTRIBUTING.md` — 브랜치 / 커밋 / PR 규칙.

## 개발 / 테스트

```bash
npm test              # 전체 테스트 (현재 482개)
npm run test:agent    # agent 패키지만
npm run test:adapters # provider adapters만
```

테스트 레이아웃:
- `packages/provider-adapters/test/shared/` — 공용 OAuth / usage snapshot / fetch helper
- `packages/provider-adapters/test/{codex,claude}/` — provider adapter
- `packages/agent/test/auth/` — auth store / token claims / callback / imported-account 등
- `packages/agent/test/cli/` — CLI 명령별 pure formatter / parser
- `packages/agent/test/services/` — registry + provider snapshot 빌더
- `packages/agent/test/integration/` — bin spawn smoke

CI(`.github/workflows/ci.yml`):
- pull_request에서는 항상 실행
- push는 main / dev 브랜치에서만 (feature 브랜치 push는 PR이 열리면 한 번만 실행)
- concurrency 그룹으로 같은 브랜치에 연속 push 시 이전 run 자동 취소

## 작업 / 협업 규칙

- 브랜치 흐름: `작업 브랜치 → dev → main`
- 커밋: `type(scope): 한글 설명` (type: feat / fix / refactor / docs / chore / ci / test / perf)
- PR 제목: `[type] 한글 요약`
- PR 본문: 요약 / 변경 내용 / 이유 / 영향 범위 / 테스트 / 리뷰 포인트

상세: `CONTRIBUTING.md` 참고.

## 다음 작업 후보

- Codex/Claude 네트워크 호출 timeout/abort (이슈 #7)
- Claude Phase 4 — session cookie fallback (이슈 #14, 옵션)
- code-base 구조 리팩터 (중복되는 provider adapter shape 통합)
- keychain 연동 / device code flow / revoke endpoint 조사

## 라이선스

추후 결정.
