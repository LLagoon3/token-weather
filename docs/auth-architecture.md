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
  │   ├─ Device code fallback
  │   └─ Manual callback/paste fallback
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

### 2. 대안: device code flow

provider가 device code를 지원하면 두 번째 우선순위로 사용한다.

적합한 상황:
- SSH 원격 환경
- 브라우저 자동 열기 불가
- localhost callback이 막힌 환경

### 3. 최후 fallback: manual paste

지원해야 할 fallback:
- callback URL 전체를 붙여넣기
- authorization code를 수동 입력
- 브라우저는 사용자 쪽에서 직접 열기 (`--no-open`)

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
- 가능한 경우 OS keychain 사용
- 초기 버전은 파일 저장소를 먼저 정의하고, 이후 keychain으로 확장 가능해야 함
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

### Phase 2
- `auth login codex` localhost callback 구현
- store 저장/조회 로직 구현
- status/usage가 새 store 우선 사용하도록 변경

### Phase 3
- refresh token 갱신
- `auth list/logout/doctor` 구현
- `auth import openclaw` migration 경로 추가

### Phase 4
- device code fallback
- manual paste fallback
- keychain 연동

## 현재 남아 있는 판단 포인트

- 토큰 저장을 초기부터 keychain 필수로 할지, 파일 저장 후 확장할지
- provider별 device code 지원 여부
- multi-account 선택 UX를 어떻게 잡을지
- 로컬 callback 포트 충돌 시 fallback 정책
