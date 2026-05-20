# 인증 아키텍처

🌐 [English](./auth-architecture.en.md) · **한국어**

## 목표

CLI agent가 외부 auth store(OpenClaw 등)에 의존하지 않고 독립적으로 인증, 토큰 저장, 갱신, 사용을 처리한다.

## 현재 구성

```text
[token-weather CLI]
  ├─ Auth Commands (login / list / logout / import)
  ├─ Auth Broker
  │   ├─ OAuth localhost callback flow (Codex / Claude 공통)
  │   ├─ Manual paste fallback (Codex)
  │   └─ Device code fallback (미구현, 후순위)
  ├─ Credential Store (~/.config/token-weather/auth.json, 0600)
  ├─ Provider Adapters (codex / claude)
  └─ Usage / Event Pipeline
```

runtime 기본 경로는 agent 자체 store 이며, OpenClaw 의존은 제거되었다. `auth import` 명령은 현재 `claude` 만 지원하고, 기존 OpenClaw auth-profiles 는 별도 import 명령으로 흡수되지 않는다 — `agent-store` 에 Codex 계정이 없을 때 status snapshot 이 read-only fallback source (`openclaw-import`) 로만 사용한다. 자세한 흐름은 [auth-cli.md](./auth-cli.md) `## import` 섹션 참고.

## 인증 흐름

### 1. Localhost callback OAuth (기본)

1. `token-weather auth login <codex|claude>`
2. 로컬 임시 서버 실행 (`127.0.0.1:<port>`)
3. PKCE(S256) / state 생성
4. 브라우저용 authorize URL 출력 (자동 오픈은 하지 않음)
5. 사용자 로그인 완료 → provider가 localhost callback으로 code 전달
6. token endpoint 에 authorization_code grant POST (default 동작 — `--mock` 시 mock 계정만 저장)
7. access/refresh token을 agent-store에 저장

provider별 callback path:

- Codex: `http://localhost:<port>/auth/callback`
- Claude: `http://localhost:<port>/callback`

### 2. Manual paste (Codex / Claude 공통 fallback)

- callback URL 전체를 붙여넣기
- `--no-open` 으로 브라우저 자동 오픈 방지
- localhost 접근이 제한된 원격 / SSH 환경에서 사용
- provider 무관 — `login-runner` 의 `runManualPasteFlow` 가 양쪽 provider 의 OAuth `code` 추출을 동일 흐름으로 처리

### 3. Claude CLI credential import (Claude 전용)

`token-weather auth import claude`로 `~/.claude/.credentials.json`의 OAuth 토큰을 agent-store에 복사한다. 네트워크 호출 없이 사용 가능한 빠른 경로.

### 4. Device code flow (미구현, 후순위)

## Credential source 우선순위

### Codex

1. `agent-store` (auth login 으로 저장된 real token)
2. `openclaw-import` (기존 OpenClaw auth-profiles.json)

### Claude

1. `agent-store` (`auth login claude` 또는 `auth import claude`로 저장된 항목)
2. `claude-cli-import` (`~/.claude/.credentials.json` 실시간 reader)

## 저장소 설계 원칙

- `~/.config/token-weather/auth.json`, 권한 `0600`
- normalized auth metadata와 민감 토큰은 논리적으로 분리 가능하게 설계
- 이후 keychain으로 확장 가능
- refresh token / session cookie는 외부 서버에 업로드 금지

## 보안 원칙

- callback 서버는 `127.0.0.1`에만 bind
- state 검증 필수 (CSRF)
- PKCE S256
- refresh token은 필요 최소 범위로 저장
- 로그에 access/refresh token 출력 금지
- raw provider 응답에서 민감 auth 값 저장 금지

## Usage/status 자동 refresh 흐름

`status` / `usage`는 단순 조회만 하지 않고, agent-store 계정에 대해서는 공통 auto-refresh orchestration을 거친다.

1. provider별 account/source 후보를 수집한다.
2. auth source 우선순위는 unfiltered 기준으로 결정한다.
3. 실제 조회 대상은 선택된 source 위에 `--account` / config 필터를 다시 적용한다.
4. agent-store 계정의 `expiresAt`이 이미 만료되었으면 provider 호출 전에 preflight refresh를 시도한다.
5. 첫 usage 호출 결과가 인증성 실패(`status.bucket === 'auth'`)면 refresh 후 1회만 재시도한다.
6. refresh 실패는 해당 계정 단위 실패로 남기고, 다른 계정 조회는 계속 진행한다.
7. import source(`openclaw-import`, `claude-cli-import`)는 store 갱신 경로가 없으므로 자동 refresh 대상에서 제외한다.

## Provider adapter 역할

auth broker는 공통이지만, provider별 전략은 adapter가 정의한다:

- authorize / token endpoint
- observed client_id
- scopes / extra params
- redirect_uri 형식 (callback path)
- refresh rotation 정책
- account 식별 규칙

## CLI

```text
token-weather auth login <codex|claude> [--mock] [--port N] [--timeout SEC] [--manual] [--no-open]
token-weather auth list
token-weather auth logout <provider> [--account <id>]
token-weather auth import claude
token-weather doctor
token-weather doctor codex [--refresh-live] [--account <id>]
token-weather doctor claude [--refresh-live]
token-weather status | usage
```

## Codex OAuth endpoint 검증 현황

### 검증됨

- authorize: `https://auth.openai.com/oauth/authorize`
- token: `https://auth.openai.com/oauth/token`
- callback: `http://localhost:1455/auth/callback`
- JWT issuer: `https://auth.openai.com`
- PKCE S256, state 검증, refresh rotation 반영: 실 토큰으로 동작 확인

### observed (공식 확정 아님)

- client_id: `app_EMoamEEZ73f0CkXaXp7hrann` (로컬 JWT payload 관찰)
- extra authorize params: `id_token_add_organizations=true`, `codex_cli_simplified_flow=true`, `originator=pi`

### 미확정

- client_secret 필요 여부 (현재 public client로 가정)
- refresh token rotation 정책의 일반 규칙
- 네트워크 호출 timeout/abort 처리 (이슈 #7)

## Claude OAuth endpoint 검증 현황

### 검증됨 (실 네트워크 호출)

- usage: `GET https://api.anthropic.com/api/oauth/usage` (Bearer + anthropic-version + anthropic-beta) → 200 OK
- refresh: `POST https://platform.claude.com/v1/oauth/token` (grant_type=refresh_token, JSON body) → 표준 OAuth 에러 응답 구조 확인
- 독립 OAuth 전체 플로우: 브라우저 로그인 → callback → token exchange(authorization_code) → agent-store 저장 → usage endpoint 200 OK까지 end-to-end 확인

### observed (Claude Code v2.1.107 바이너리 strings에서 추출)

- authorize: `https://claude.com/cai/oauth/authorize` (claude.ai 사용자 OAuth 경로)
- token: `https://platform.claude.com/v1/oauth/token`
- manual redirect: `https://platform.claude.com/oauth/code/callback`
- client_id: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- scopes: `org:create_api_key user:profile user:inference`

### Claude 관찰 기반 알림

- authorize URL에 `code=true` 파라미터가 추가로 필요 (OAuth 스펙 외 확장)
- token endpoint는 JSON body를 요구 (form-urlencoded는 Claude API 에러)
- authorization_code grant는 body에 `state`를 포함해야 함
- redirect_uri 경로는 `/callback` (Codex의 `/auth/callback`과 다름)

### 미확정

- client_secret 필요 여부 (public client 가정)
- refresh token rotation 정책
- 다른 client_id 값이 존재하는지 (`22422756-...`는 local-oauth 전용인 것으로 보임)

## 인증 default

Codex / Claude 의 `auth login` 은 default 로 실제 OAuth 토큰 교환을 수행한다 (token endpoint POST → access/refresh token 저장). `--mock` opt-in 으로만 mock 계정 저장. provider-adapters 라이브러리의 `exchange*` / `refresh*` 함수도 가드 없이 직접 호출 가능 — `allowLiveExchange` 매개변수는 #97 에서 제거됐다.

## 운영 방안

- 토큰 저장: `auth.json` + `0600` (기본 경로 `~/.config/token-weather/`)
- multi-account: `lastUsedAt` 자동 선택 + `--account` override
- callback 포트 충돌 시: 기본 포트부터 최대 3회 대체 포트 시도 → 실패 시 manual paste로 전환 (Codex)
- timeout: `--timeout <seconds>` (기본 120초)
- device code는 후순위 조사 항목

## 다음 단계 후보

- 네트워크 호출 timeout/abort (Codex/Claude 공통, 이슈 #7)
- revoke endpoint 지원 여부 조사 (logout 시 서버측 무효화)
- Claude Phase 4 — session cookie fallback (옵션, 이슈 #14)
- keychain 연동
- device code flow
