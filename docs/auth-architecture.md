# 인증 독립화 아키텍처

## 목표

`ai-usage-agent`가 OpenClaw의 `auth-profiles.json` 없이도 독립적으로 인증, 토큰 저장, 갱신, 사용을 처리할 수 있게 한다.

## 현재 문제

현재 Codex adapter는 OpenClaw auth store를 직접 읽는다.

- 결합도가 높음
- OpenClaw 미설치 환경에서 단독 동작 불가
- 향후 배포형 CLI 패키지로 사용할 때 UX가 제한됨

## 목표 상태

로컬 에이전트가 자체 auth broker를 가진다.

```text
[ai-usage-agent CLI]
  ├─ Auth Commands
  ├─ Auth Broker
  │   ├─ OAuth localhost callback flow
  │   ├─ Manual callback/paste fallback
  │   └─ Device code fallback (후순위)
  ├─ Credential Store
  ├─ Provider Adapters
  └─ Usage / Event Pipeline
```

## 권장 인증 흐름

### 1. 기본: localhost callback OAuth

기본 경로는 브라우저 로그인 + localhost callback 방식이다.

흐름:
1. `ai-usage-agent auth login codex`
2. 로컬 임시 서버 실행 (`127.0.0.1` 기반)
3. PKCE/state 생성
4. 로그인 URL 생성 후 브라우저 열기
5. 사용자가 로그인 완료
6. provider가 localhost callback으로 code 전달
7. agent가 token exchange 수행
8. access/refresh token을 자체 저장소에 저장

장점:
- UX가 가장 자연스러움
- 사용자가 기존 웹 로그인 흐름에 익숙함
- refresh token 기반 재사용 설계가 쉬움

### 2. 우선 fallback: manual paste

현 시점 우선 fallback은 manual paste 방식이다.

지원해야 할 흐름:
- callback URL 전체를 붙여넣기
- authorization code를 수동 입력
- 브라우저는 사용자 쪽에서 직접 열기 (`--no-open`)

이 방식이면 localhost callback이 실패하는 데스크톱/SSH 환경도 우선 커버할 수 있다.

### 3. 후순위 조사: device code flow

provider가 device code를 안정적으로 지원하는지 확인되면 이후 단계에서 추가한다.

현재는 구현 우선순위를 낮춘다.

## Credential Source 추상화

현재의 OpenClaw reader는 최종 형태가 아니라 migration source 중 하나로 내려가야 한다.

권장 추상화:
- `agent-store`
- `openclaw-import`
- `env`
- `manual`

기본 우선순위:
1. `agent-store`
2. `env`
3. `openclaw-import` (명시적 import 또는 migration 용도)

즉 런타임 기본 경로는 OpenClaw 의존이 아니어야 한다.

## 저장소 설계 원칙

- normalized auth metadata와 민감 토큰은 논리적으로 분리 가능해야 함
- 초기 버전은 `auth.json` + `0600` 파일 저장으로 시작
- 이후 keychain으로 확장 가능해야 함
- 서버로 refresh token / session cookie / sessionKey 업로드 금지

## 보안 원칙

- callback 서버는 기본적으로 `127.0.0.1`에만 bind
- state 검증 필수
- PKCE 사용 권장
- refresh token은 필요 최소 범위로 저장
- 로그에 access token / refresh token 출력 금지
- raw provider 응답에서 민감 auth 값은 저장 금지

## Provider adapter 역할

auth broker는 공통이지만, provider별 전략은 adapter가 정의한다.

예:
- auth URL 생성 규칙
- token exchange endpoint
- refresh endpoint
- 지원 가능한 fallback 종류
- account 식별 방식

## CLI와의 연결

예상 명령:
- `ai-usage-agent auth login codex`
- `ai-usage-agent auth list`
- `ai-usage-agent auth logout codex`
- `ai-usage-agent auth doctor`
- `ai-usage-agent auth import openclaw`

## 단계별 구현 제안

### Phase 1
- auth architecture 문서화
- credential store schema 정의
- CLI 인터페이스 초안 정의

### 현재까지 구현/검증 완료
- auth store 저장/조회 로직 구현
- multi-account resolver 구현
- `auth login codex` CLI 기본 경로 (authorize → callback → mock 저장)
- localhost callback 서버 구현 및 code/state 수신 동작 검증
- manual paste fallback의 mock 저장 흐름 구현
- Codex token exchange 함수 구현 (guarded real fetch)
- `--live-exchange` 경로: 실제 token exchange 및 real token 저장 동작 검증됨 (실험적)
- agent-store real token 우선으로 usage 조회 연결
- account 식별: id_token/access_token JWT claims 기반 추출 (email → preferred_username → sub 순, fallback: code prefix)

### 다음 단계
- `auth import openclaw` 경로 정리
- revoke endpoint 지원 여부 확인
- Claude 등 다른 provider auth 경로 확장

### 후순위 단계
- device code fallback 조사/도입
- keychain 연동

## Codex OAuth endpoint 검증 현황

아래는 OpenClaw 로컬 문서/코드 및 JWT 관찰값으로부터 확인된 사실이다.

### 검증됨 (출처: OpenClaw docs/concepts/oauth.md, provider-openai-codex-oauth-tls-*.js)
- authorize: `https://auth.openai.com/oauth/authorize`
- token: `https://auth.openai.com/oauth/token`
- callback: `http://localhost:1455/auth/callback` (host는 `localhost` — OpenClaw 관찰 기준)
- JWT issuer: `https://auth.openai.com` (로컬 ~/.codex/auth.json 관찰)

### 관찰됨 — 미확정
- client_id `app_EMoamEEZ73f0CkXaXp7hrann` — 로컬 JWT payload에서 관찰. 공식 문서로 확정된 값이 아니므로 변경 가능성 있음.

### 구현 완료
- PKCE S256 code_challenge 생성 (plain에서 S256으로 교체)
- redirect_uri 경로를 `/auth/callback`으로 통일
- 기본 콜백 포트를 1455로 변경 (OpenClaw 문서 기준)
- redirect_uri host를 `localhost`로 변경 (OpenClaw 관찰 기준)
- scopes를 `openid profile email offline_access`로 정렬 (OpenClaw 관찰 기준)
- extra authorize params 반영: `id_token_add_organizations`, `codex_cli_simplified_flow`, `originator`

### observed alignment 참고
현재는 OpenClaw가 실제로 생성하는 authorize URL과 최대한 동일하게 정렬했다.
단, 이것은 OpenClaw 동작 관찰 기반 정렬(observed alignment)이며, OpenAI 공식 문서에
의한 확정이 아니다. provider 측 변경이 있으면 재정렬이 필요할 수 있다.

### 검증 완료
- 실제 refresh token 재발급 성공
- refresh token rotation 발생 시 store 반영 성공
- refresh 직후 agent-store 기준 usage 조회 `OK (200)` 재확인

### 여전히 미확정
- client_secret 필요 여부
- refresh token rotation 정책의 일반 규칙 (매번 rotation되는지 여부 등)

### token exchange 구현 상태 (guarded real fetch)

`exchangeCodexAuthorizationCode()`와 `refreshCodexToken()`은 실제 fetch 경로가 구현되어 있으나
**기본 동작은 guarded** 상태이다.

- `allowLiveExchange` 옵션이 `false`(기본값)이면 기존처럼 에러를 던진다.
- `allowLiveExchange: true`를 명시적으로 전달해야 실제 POST가 수행된다.
- `clientId` 기본값은 관찰된 `app_EMoamEEZ73f0CkXaXp7hrann`을 사용하되,
  이 값이 공식 확정이 아니라는 점은 에러 메시지와 문서 양쪽에서 명시한다.

이 guard는 다음 조건이 모두 확인될 때까지 유지한다:
1. client_id 공식 확정
2. client_secret 요구사항 확인

guard를 해제할 때는 기본값을 `true`로 바꾸거나 옵션 자체를 제거하면 된다.

## 현재 확정된 운영 방안

- 토큰 저장은 초기 버전에서 `auth.json` + `0600`으로 시작
- device code는 후순위 조사 항목으로 둠
- multi-account는 `lastUsedAt` 자동 선택 + `--account` override 사용
- callback 포트 충돌 시 기본 포트(1455)부터 최대 3회 대체 포트 시도 후 manual paste로 전환
