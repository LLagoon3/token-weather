# ai-usage-dashboard

여러 AI 서비스의 사용량, quota window, 사용 가능 상태를 한곳에서 통합해서 보여주는 대시보드 프로젝트.

## 목표

이 프로젝트는 여러 AI 서비스의 다음 정보를 통합해서 보여주는 것을 목표로 한다.

- 남은 quota / usage window
- reset 시각
- 현재 사용 가능 여부
- 최근 rate limit / usage limit / 인증 오류
- turn 단위 usage와 quota usage의 분리 표시

## 핵심 방향

이 프로젝트는 모든 provider를 단일 방식으로 처리하지 않는다.

- 공식 API 또는 OAuth usage endpoint가 안정적인 provider는 서버에서 직접 조회
- 로컬 CLI 로그인 상태, 세션 쿠키, auth store 재사용이 필요한 provider는 로컬 에이전트 사용
- 최종적으로는 로컬 에이전트 + 서버 poller + 공통 정규화 계층 구조를 사용

## 확인된 endpoint 예시

- Codex: `https://chatgpt.com/backend-api/wham/usage`
- Claude OAuth: `https://api.anthropic.com/api/oauth/usage`
- Claude web fallback:
  - `https://claude.ai/api/organizations`
  - `https://claude.ai/api/organizations/{orgId}/usage`

## 아키텍처 개요

```text
[로컬 에이전트]
  ├─ Provider Adapters
  ├─ Credential Broker
  ├─ Event Normalizer
  ├─ Local SQLite
  └─ Uploader
         ↓
[백엔드 API]
  ├─ Ingestion API
  ├─ Direct Usage Pollers
  ├─ Event Store
  ├─ State Aggregator
  └─ Dashboard API
         ↓
[웹 대시보드]
```

## 프로젝트 구조

```text
apps/
  web/
  api/
packages/
  agent/
  shared/
  provider-adapters/
  schemas/
docs/
  architecture.md
  auth-architecture.md
  auth-store-schema.md
  auth-cli.md
  provider-notes.md
scripts/
  poc/
```

## 초기 범위(MVP)

- npm 설치형 로컬 에이전트 CLI 골격
- Codex adapter
- Claude adapter
- usage snapshot 수집
- 이벤트 정규화
- overview / timeline UI
- provider별 상태 버킷화

## 상태 버킷 예시

- `ok`
- `rate_limit`
- `usage_window`
- `billing`
- `auth`
- `overloaded`
- `unknown`

## 작업 / 협업 규칙

자세한 규칙은 `CONTRIBUTING.md`를 따른다. 요약은 아래와 같다.

- 브랜치 흐름: `작업 브랜치 -> dev -> main`
- 커밋 형식: `type(scope): 한글 설명`
- PR 제목 형식: `[feat] 한글 요약`
- PR 본문은 기본적으로 한글로 작성
- 큰 변경은 문서와 예시 payload를 함께 갱신

### 커밋 예시

- `feat(codex): usage endpoint 응답을 공통 snapshot으로 변환`
- `fix(web): overview 카드 reset 시각 포맷 오류 수정`
- `docs(repo): 브랜치 전략과 PR 규칙 추가`

## 보안 원칙

- refresh token / session cookie / sessionKey는 서버에 저장하지 않음
- raw prompt / raw response / 전체 transcript 업로드 금지
- 서버에는 정규화된 메타데이터만 업로드

## 에이전트 실행 예시

프로젝트 루트에서 바로 실행 가능:

```bash
npm run agent:status
npm run agent:usage
npm run agent:doctor
npm run agent:config:init
```

## 공통 스키마 초안

`packages/schemas`에 초기 JSON Schema 초안을 추가했다.

- `usage-snapshot.schema.json`
- `usage-event.schema.json`
- `examples/codex-usage-snapshot.example.json`
- `examples/codex-auth-error.event.example.json`

핵심 필드:
- `source`
- `authType`
- `confidence`
- `usageWindows`
- `status.bucket` / `reason.bucket`

## 인증 독립화 설계 초안

OpenClaw auth profile 의존을 제거하기 위한 계획 문서를 추가했다.

- `docs/auth-architecture.md`
- `docs/auth-store-schema.md`
- `docs/auth-cli.md`

현재 방향:
- 기본 auth 흐름: localhost callback OAuth
- fallback 1: manual paste / callback URL handoff
- device code는 필요 시점에 후순위로 조사
- 장기적으로는 agent 자체 auth store 사용
- OpenClaw import는 migration 보조 기능으로만 유지

## 현재 auth 독립화 진행 상태

현재까지 구현됨:
- agent 전용 `auth.json` store 골격
- multi-account account resolver
- `auth login codex` CLI 골격
- localhost callback 준비 코드와 포트 fallback 뼈대
- `auth login codex --manual` 입력 처리와 placeholder/mock store 저장 흐름

## 다음 작업

1. localhost callback 서버 골격 구현
2. callback code/state 수신 처리
3. placeholder token exchange를 callback 경로와 연결
4. 이후 실제 provider token exchange로 교체
5. Claude 인증 경로별 테스트 추가
6. 대시보드 MVP 화면 구성

## 라이선스

추후 결정
