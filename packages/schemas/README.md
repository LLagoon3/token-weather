# schemas

AI 사용량 통합 대시보드의 공통 데이터 스키마 패키지.

## 현재 구현 상태

초기 초안 단계이며, Codex adapter를 기준으로 첫 버전을 정의했다.

현재 포함:

- `usage-snapshot.schema.json`
- `usage-event.schema.json`
- `examples/codex-usage-snapshot.example.json`
- `examples/codex-auth-error.event.example.json`

## 설계 원칙

- provider별 응답 형식을 내부 공통 구조로 정규화
- CLI, 업로더, API, 웹이 같은 계약을 공유
- 시간 필드는 ISO datetime string 사용
- provider 고유 원본값은 `raw`에 보존
- `source`, `authType`, `confidence`를 필수 개념으로 유지

## usage snapshot

현재 상태를 표현하는 스키마.

핵심 필드:

- `schemaVersion`
- `snapshotId`
- `capturedAt`
- `provider`
- `account`
- `source`
- `authType`
- `confidence`
- `status`
- `usageWindows`
- `credits`
- `raw`

## usage event

오류, 제한, 관측 이벤트를 표현하는 스키마.

핵심 필드:

- `schemaVersion`
- `eventId`
- `occurredAt`
- `provider`
- `account`
- `source`
- `authType`
- `confidence`
- `reason`
- `severity`
- `raw`

## 현재 한계

- 아직 validator 연결 전
- 아직 모든 provider를 포괄하지는 않음
- taxonomy와 field naming은 adapter 확장하면서 추가 조정 가능
