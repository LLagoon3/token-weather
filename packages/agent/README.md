# agent

로컬 환경에서 AI 서비스 usage/quota 상태를 수집하고 CLI로 보여주는 패키지.

## 현재 구현 상태

현재 이 패키지는 설치형 CLI 에이전트의 초기 버전이다.

구현된 것:
- CLI 엔트리포인트: `bin/token-weather.js`
- 명령 라우팅 구조
- 기본 설정 파일 생성 및 로딩
- agent 전용 `auth.json` store 경로 해석 및 load/save 골격
- account resolver: provider별 기본 계정 자동 선택 및 명시 선택
- `auth login codex` CLI 골격
- localhost callback 준비 코드 및 포트 fallback 뼈대
- manual paste 입력 처리 및 mock auth store 저장 흐름 (manual 경로만 mock)
- Codex provider live usage 조회 결과 출력
- 공통 snapshot 스키마 기반 출력 흐름

아직 미구현 또는 초기 상태:
- Claude adapter 연결
- `inspect <provider>` 상세 출력
- `sync` 업로드 기능
- 정식 formatter / table renderer
- schema validation
- provider 측 revoke endpoint 호출 (logout은 로컬 제거만 수행)

## 현재 가능한 명령

- `token-weather status`
  - 현재 설정과 Codex live usage 결과를 출력
- `token-weather usage`
  - 현재는 `status`와 동일한 경로로 usage 요약 출력
- `token-weather doctor`
  - auth/config/path/endpoint 진단용 명령 자리
- `token-weather config init`
  - 기본 설정 파일 생성
- `token-weather auth login codex`
  - authorize → localhost callback → code/state 수신까지 동작 검증됨
  - 기본 경로는 token exchange 없이 mock 저장으로 끝남
  - authorize URL은 OpenClaw 관찰 기준으로 정렬됨 (observed alignment, 공식 확정 아님)
- `token-weather auth login codex --live-exchange`
  - callback code 수신 후 실제 token endpoint에 POST를 수행 (실험적, 동작 검증됨)
  - 성공 시 real token을 auth store에 저장, 실패 시 에러 표시 (mock fallback 없음)
  - PKCE S256 적용됨, client_id는 observed 값 (공식 확정 아님)
  - account 식별: id_token/access_token claims 기반 (email → preferred_username → sub), 불가 시 code prefix fallback
- `token-weather auth login codex --manual`
  - callback URL/code 입력을 받아 placeholder/mock 계정을 auth store에 저장
  - 아직 실제 OAuth token exchange는 아님
- `token-weather auth list`
  - 저장된 모든 provider의 인증 계정 목록 출력
  - provider, accountKey, email, source, authType, expiresAt, mock 여부, refresh 가능 여부 표시
- `token-weather auth list codex`
  - 특정 provider 계정만 필터하여 출력
- `token-weather auth logout codex`
  - 기본 선택 계정(single 또는 lastUsedAt 기준)을 로컬 저장소에서 제거
  - provider 측 revoke endpoint 호출은 아직 미구현
- `token-weather auth logout codex --account <email|accountKey>`
  - 특정 계정을 지정하여 제거

## 로컬 개발 실행

프로젝트 루트에서:

```bash
npm run agent:status
npm run agent:usage
npm run agent:doctor
npm run agent:config:init
```

또는 직접 실행:

```bash
node packages/agent/bin/token-weather.js status
```

## 설정 파일

기본 설정 경로:

```text
~/.config/token-weather/config.json
```

현재 기본 설정에는 아래 항목이 들어간다:
- 출력 포맷
- sync 사용 여부
- provider 활성화 여부

## 현재 Codex 연동 방식

- 기본 auth source는 agent 전용 `auth.json` store
- real token이 있으면 agent-store를 우선 사용해 Codex usage endpoint를 bearer auth로 호출
- agent-store에 usable token이 없을 때만 OpenClaw auth profile reader를 fallback으로 사용
- 응답을 공통 snapshot 구조로 변환
- 시간 필드는 ISO datetime string으로 정규화
- provider 원본값은 snapshot의 `raw`에 보존

## 예정 명령

- `token-weather inspect <provider>`
- `token-weather sync`
- `token-weather doctor` / `doctor codex` / `doctor codex --refresh-live` (인증 상태 진단)
- `token-weather auth import openclaw` (기존 OpenClaw 마이그레이션)
