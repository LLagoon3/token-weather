# Auth CLI 인터페이스 초안

## 목표

`ai-usage-agent`가 OpenClaw 없이도 자체 인증을 수행할 수 있도록 auth 관련 CLI 명령 집합을 정의한다.

## 기본 명령 구조

```text
ai-usage-agent auth <subcommand> [provider] [options]
```

## 우선 구현 후보

### 1. login

```bash
ai-usage-agent auth login codex
```

현재 구현 상태:
- authorize → localhost callback → code/state 수신까지 동작 검증됨
- authorization URL은 OpenClaw observed alignment 기준으로 생성됨
- 기본 경로는 token exchange 없이 mock 저장으로 끝남
- `--live-exchange` 옵션으로 실제 token exchange 수행 가능 (동작 검증됨, 실험적)
- 브라우저 자동 열기는 아직 미구현
- `--manual`에서는 mock 저장 흐름이 동작

옵션 예시:

```bash
ai-usage-agent auth login codex --no-open
ai-usage-agent auth login codex --manual
ai-usage-agent auth login codex --device
ai-usage-agent auth login codex --port 38123
ai-usage-agent auth login codex --live-exchange
```

옵션 의미:
- `--no-open`: 브라우저 자동 실행 안 함
- `--manual`: callback URL 또는 code 수동 입력 흐름 강제
- `--device`: 후순위 실험용 옵션, provider 지원 확인 전까지는 기본 경로로 사용하지 않음
- `--port`: localhost callback 포트 지정
- `--live-exchange`: **실험적** — callback에서 수신한 code로 실제 token endpoint에 POST를 시도.
  기본 동작(mock 저장)을 대체하며, 실패 시 mock fallback 없이 에러를 표시.
  주의: PKCE S256이 적용되어 있으나, client_id는 관찰값(observed)이므로 성공이 보장되지 않음.
  성공 시 account 식별은 id_token → access_token JWT claims에서 추출을 시도하며,
  claims를 얻을 수 없으면 code prefix 기반 임시값으로 fallback한다.
  어떤 claim source가 사용되었는지는 저장된 raw의 `identityClaimSource`에 기록된다.

### 2. list

```bash
ai-usage-agent auth list
ai-usage-agent auth list openai-codex
ai-usage-agent auth list claude
```

Claude 구현 상태:
- `auth list claude`는 `~/.claude/.credentials.json` 기준으로 account 표시
- 수동 CLI 검증 완료 (live network 호출 없음)
- write/import 경로는 미구현 (다음 단계)

현재 출력 필드:
- provider
- accountKey
- email
- source
- authType
- expiresAt
- mock 여부
- refresh 가능 여부

### 3. logout

```bash
ai-usage-agent auth logout codex
ai-usage-agent auth logout codex --account choonarm3@gmail.com
```

동작:
- 로컬 auth store에서 해당 계정 제거
- provider 측 revoke endpoint 호출은 아직 미구현

### 4. doctor

```bash
ai-usage-agent doctor
ai-usage-agent doctor codex
ai-usage-agent doctor codex --refresh-live
ai-usage-agent doctor claude
```

Claude 구현 상태:
- `doctor claude`는 `~/.claude/.credentials.json` 기준으로 selectedAccount 표시
- 수동 CLI 검증 완료 (live network 호출 없음)

점검 항목:
- auth store 존재 여부
- provider 계정 존재 여부
- expiresAt 만료 여부
- refresh 가능 여부
- callback 포트/환경 문제 힌트
- 현재 기본 선택될 계정이 무엇인지
- `--refresh-live` 시 실제 refresh token 재발급 시도 및 store 갱신

### 5. import

```bash
ai-usage-agent auth import openclaw
```

목적:
- 기존 OpenClaw 사용자의 migration 지원
- 런타임 기본 의존이 아니라 초기 전환 도구로만 제공

## 추천 UX 원칙

- 기본 명령은 최대한 짧게
- 세부 제어는 옵션으로 열기
- 실패 시 단순한 에러 대신 다음 행동을 안내
- headless 환경을 위한 fallback 경로를 명확히 제공
- multi-account는 자동 선택 + 명시 override 방식으로 단순하게 유지

## 예시 시나리오

### 일반 데스크톱 환경

```bash
ai-usage-agent auth login codex
```

출력:
1. 브라우저를 여는 중...
2. 로그인 완료 후 callback 수신 대기...
3. 저장 완료

### SSH / 원격 환경

```bash
ai-usage-agent auth login codex --manual --no-open
```

현재 출력/동작:
1. callback URL 전체 또는 code 입력 요청
2. mock 계정을 auth store에 저장 (manual 경로는 token exchange 미수행)

## 포트 충돌 정책

- 기본 포트: `1455` (OpenClaw 문서 기준)
- 포트 충돌 시 `1456`, `1457` 순으로 최대 3회 자동 재시도
- 3회 모두 실패하면 manual paste 모드로 자동 전환
- 사용자가 `--port`를 명시한 경우는 해당 포트만 시도하고 실패 시 에러 반환

## multi-account 정책

- 계정이 1개면 자동 선택
- 계정이 여러 개면 `lastUsedAt`이 가장 최근인 active 계정 사용
- `--account`로 명시 지정 가능

## Codex OAuth endpoint 검증 현황

아래 endpoint는 OpenClaw 로컬 문서/코드로부터 검증됨:
- authorize: `https://auth.openai.com/oauth/authorize`
- token: `https://auth.openai.com/oauth/token`
- callback: `http://localhost:1455/auth/callback` (host는 `localhost` — OpenClaw 관찰 기준)

client_id `app_EMoamEEZ73f0CkXaXp7hrann`은 로컬 JWT에서 관찰된 값이며, 공식 확정이 아님.

현재 authorize URL은 OpenClaw가 실제로 생성하는 URL과 최대한 동일하게 정렬했다 (observed alignment).
- scopes: `openid profile email offline_access`
- extra params: `id_token_add_organizations=true`, `codex_cli_simplified_flow=true`, `originator=pi`

이 정렬은 관찰 기반이며 공식 문서 확정이 아니므로, provider 변경 시 재정렬이 필요할 수 있다.

## token exchange guard 정책

`exchangeCodexAuthorizationCode()`와 `refreshCodexToken()`은 실제 fetch 코드가 포함되어 있지만,
기본 동작은 `allowLiveExchange: false`로 보호되어 외부 호출을 하지 않는다.

- CLI에서 `--live-exchange` 옵션을 명시하면 `allowLiveExchange: true`로 실제 token endpoint POST가 수행된다.
- `--live-exchange` 없이 실행하면 기존과 동일한 mock 저장 흐름을 유지한다.
- live exchange 실패 시 mock fallback 없이 에러를 표시한다 (사용자 혼동 방지).
- `doctor codex --refresh-live`로 실제 refresh POST를 명시적으로 검증할 수 있다.
- refresh 성공 시 accessToken, refreshToken, expiresAt를 store에 반영하고, 실패 시 저장값은 유지한다.
- PKCE S256은 구현 완료됨. 이 guard는 client_id 공식 확정 시점까지 유지한다.

## 아직 미정인 부분

- client_id 공식 확정 (현재는 관찰값만 존재)
- client_secret 요구사항
- revoke endpoint를 각 provider에서 어디까지 지원할지
- `auth import openclaw`를 기본 노출할지 숨길지
- device code를 실제로 도입할 provider 범위
- claims에서 실제 email/sub가 얼마나 안정적으로 오는지 추가 관찰
