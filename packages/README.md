# packages

이 repo의 핵심 패키지 모음. CLI agent와 그 구성 요소를 포함한다.

## 패키지

### `agent`

로컬 CLI 에이전트. 이 repo의 주 진입점.

현재 구현됨:

- `status`, `usage`, `doctor`, `config init` 명령
- `auth login`, `auth list`, `auth logout` 명령
- `doctor`, `doctor codex`, `doctor codex --refresh-live` 명령
- multi-account resolver (lastUsedAt 자동 선택 + --account override)
- Codex live usage 결과 출력
- id_token/access_token JWT claims 기반 계정 식별

### `provider-adapters`

provider별 인증/endpoint 연결 및 usage 정규화.

현재 구현됨:

- Codex OAuth 인증 (localhost callback + PKCE S256)
- Codex usage endpoint 호출 및 공통 snapshot 정규화
- token exchange, refresh token rotation 처리
- provider 원본 응답을 `raw`에 보존

### `schemas`

공통 데이터 계약.

현재 구현됨:

- `usage-snapshot.schema.json`
- `usage-event.schema.json`
- Codex 기준 example payload
- ISO datetime string 기반 시간 필드 정의
