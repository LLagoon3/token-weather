# schemas

AI 사용량 통합 대시보드의 공통 데이터 스키마 초안.

## 포함 스키마

- `usage-snapshot.schema.json`: provider/account 단위 현재 상태
- `usage-event.schema.json`: 제한, 오류, 관측 이벤트

## 목적

- provider별 응답 형식을 내부 공통 구조로 정규화
- CLI, 업로더, API, 웹이 같은 계약을 공유
- `source`, `authType`, `confidence`를 필수 개념으로 유지

## 현재 상태

초기 초안 단계이며, Codex adapter를 기준으로 첫 버전을 정의했다.
