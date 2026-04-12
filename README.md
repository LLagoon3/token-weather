# ai-usage-dashboard

AI 서비스별 사용량, quota window, 사용 가능 상태를 통합해서 보여주는 대시보드 프로젝트.

## 목표

여러 AI 서비스의 다음 정보를 한 곳에서 확인한다.

- 남은 quota / usage window
- reset 시각
- 현재 사용 가능 여부
- 최근 rate limit / usage limit / auth error
- turn-level usage와 quota usage의 구분된 표시

## 핵심 방향

이 프로젝트는 단일 방식으로 모든 provider를 처리하지 않는다.

- 공식 API/OAuth usage endpoint가 안정적인 provider는 서버 직조회
- 로컬 CLI 로그인, 세션 쿠키, auth store 재사용이 필요한 provider는 로컬 에이전트 사용
- 최종적으로는 로컬 에이전트 + 서버 poller + 공통 정규화 계층 구조를 사용

## 확인된 endpoint 예시

- Codex: `https://chatgpt.com/backend-api/wham/usage`
- Claude OAuth: `https://api.anthropic.com/api/oauth/usage`
- Claude web fallback:
  - `https://claude.ai/api/organizations`
  - `https://claude.ai/api/organizations/{orgId}/usage`

## 아키텍처

```text
[Local Agent]
  ├─ Provider Adapters
  ├─ Credential Broker
  ├─ Event Normalizer
  ├─ Local SQLite
  └─ Uploader
         ↓
[Backend API]
  ├─ Ingestion API
  ├─ Direct Usage Pollers
  ├─ Event Store
  ├─ State Aggregator
  └─ Dashboard API
         ↓
[Web Dashboard]
```

## 프로젝트 구조

```text
apps/
  web/
  api/
packages/
  shared/
  provider-adapters/
  schemas/
docs/
  architecture.md
  provider-notes.md
scripts/
  poc/
```

## 초기 범위(MVP)

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

## 보안 원칙

- refresh token / session cookie / sessionKey는 서버에 저장하지 않음
- raw prompt / raw response / 전체 transcript 업로드 금지
- 서버에는 정규화된 메타데이터만 업로드

## 다음 작업

1. monorepo scaffold 정리
2. 공통 schema 설계
3. Codex usage PoC를 provider adapter로 흡수
4. Claude 인증 경로별 테스트 추가
5. dashboard MVP 화면 구성

## 라이선스

TBD
