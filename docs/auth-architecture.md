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

### 현재까지 반영된 골격
- auth store 저장/조회 로직 구현
- multi-account resolver 구현
- `auth login codex` CLI 골격 구현
- localhost callback 준비 코드 및 포트 fallback 뼈대 구현
- manual paste fallback의 placeholder/mock 저장 흐름 구현

### 다음 단계
- localhost callback 서버 골격 구현
- callback code/state 수신 처리
- placeholder token exchange를 callback 경로와 연결
- Codex token exchange draft 함수 시그니처와 endpoint/params 정리
- 이후 실제 provider token exchange로 교체
- `auth list/logout/doctor` 및 `auth import openclaw` 확장

### 후순위 단계
- device code fallback 조사/도입
- keychain 연동

## Codex token exchange 관련 현재 판단

현재 repo에는 Codex token exchange draft가 추가되었지만, 아래 항목은 아직 미확정이다.

- 실제 token endpoint URL 검증
- 실제 client_id 확인
- client_secret 필요 여부
- refresh token rotation 정책
- PKCE S256 적용

즉 다음 단계 구현은 이 draft 함수의 예외 처리 블록을 실제 fetch로 교체하는 방향이 된다.

## 현재 확정된 운영 방안

- 토큰 저장은 초기 버전에서 `auth.json` + `0600`으로 시작
- device code는 후순위 조사 항목으로 둠
- multi-account는 `lastUsedAt` 자동 선택 + `--account` override 사용
- callback 포트 충돌 시 기본 포트부터 최대 3회 대체 포트 시도 후 manual paste로 전환
