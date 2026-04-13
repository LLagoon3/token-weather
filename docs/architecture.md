# 아키텍처

## 요약

이 repo는 로컬 CLI agent 중심 구조이다.

- 로컬 에이전트가 provider별 인증과 usage 조회를 직접 처리
- provider adapter가 각 서비스의 인증/endpoint/정규화를 담당
- 공통 schema가 데이터 계약을 정의

## 현재 구조

```text
[CLI Agent]
  ├─ Auth Commands (login / list / logout / doctor)
  ├─ Auth Broker (OAuth localhost callback, manual paste fallback)
  ├─ Credential Store (agent-store: auth.json)
  ├─ Provider Adapters (Codex 구현, Claude 예정)
  ├─ Usage / Event Pipeline
  └─ Snapshot Normalizer
```

## 주요 구성 요소

### CLI Agent (`packages/agent`)
- `status`, `usage`, `doctor`, `config init` 명령
- `auth login/list/logout` 명령
- multi-account resolver

### Provider Adapters (`packages/provider-adapters`)
- provider별 인증 해석 및 auth URL 생성
- usage endpoint 호출 및 응답 정규화
- Codex adapter: 구현 및 동작 검증 완료
- Claude adapter: endpoint 확인, 인증 미구현

### Schemas (`packages/schemas`)
- `usage-snapshot.schema.json`
- `usage-event.schema.json`
- 공통 데이터 계약 정의

### 인증 계층
- 기본 흐름: localhost callback OAuth (PKCE S256)
- fallback: manual callback/code paste
- 후순위: device code (미구현)
- credential source: `agent-store` > `openclaw-import` (`env`는 후속 작업 후보)

## 향후 확장 가능성

- 백엔드 API: 정규화 이벤트 수집, provider 직접 poll, 상태 집계
- 웹 대시보드: overview, provider/account 상세, timeline
