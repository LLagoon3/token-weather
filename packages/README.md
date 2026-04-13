# packages

모노레포 내부 패키지 모음.

## 현재 패키지

### `agent`
로컬에서 실행되는 CLI 에이전트 패키지.

현재 구현됨:
- `status`, `usage`, `doctor`, `config init` 명령 골격
- 로컬 설정 파일 경로 해석
- Codex live usage 결과 출력
- 공통 snapshot 스키마를 읽는 CLI 출력 흐름

### `provider-adapters`
provider별 인증/endpoint 연결 로직 패키지.

현재 구현됨:
- Codex OAuth auth profile 읽기
- Codex usage endpoint 호출
- 응답을 공통 usage snapshot 형태로 정규화
- provider 원본 응답을 `raw`에 보존

### `schemas`
공통 데이터 계약 패키지.

현재 구현됨:
- `usage-snapshot.schema.json`
- `usage-event.schema.json`
- Codex 기준 example payload
- ISO datetime string 기반 시간 필드 정의

### `shared`
공통 유틸리티 패키지 자리.

현재는 아직 본격 구현 전.
