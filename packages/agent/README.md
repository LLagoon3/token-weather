# agent

로컬 환경에서 AI 서비스 usage/quota 상태를 수집하고 CLI로 보여주는 패키지.

## 현재 구현 상태

현재 이 패키지는 설치형 CLI 에이전트의 초기 버전이다.

구현된 것:
- CLI 엔트리포인트: `bin/ai-usage-agent.js`
- 명령 라우팅 구조
- 기본 설정 파일 생성 및 로딩
- agent 전용 `auth.json` store 경로 해석 및 load/save 골격
- account resolver: provider별 기본 계정 자동 선택 및 명시 선택
- `auth login codex` CLI 골격
- localhost callback 준비 코드 및 포트 fallback 뼈대
- manual paste 입력 처리 및 placeholder/mock auth store 저장 흐름
- Codex provider live usage 조회 결과 출력
- 공통 snapshot 스키마 기반 출력 흐름

아직 미구현 또는 초기 상태:
- Claude adapter 연결
- `inspect <provider>` 상세 출력
- `sync` 업로드 기능
- 정식 formatter / table renderer
- schema validation

## 현재 가능한 명령

- `ai-usage-agent status`
  - 현재 설정과 Codex live usage 결과를 출력
- `ai-usage-agent usage`
  - 현재는 `status`와 동일한 경로로 usage 요약 출력
- `ai-usage-agent doctor`
  - auth/config/path/endpoint 진단용 명령 자리
- `ai-usage-agent config init`
  - 기본 설정 파일 생성
- `ai-usage-agent auth login codex`
  - localhost callback 서버가 code/state 수신까지 동작 (placeholder/mock 저장)
- `ai-usage-agent auth login codex --live-exchange`
  - callback code 수신 후 실제 token endpoint에 POST를 시도 (실험적)
  - 성공 시 real token을 auth store에 저장, 실패 시 에러 표시 (mock fallback 없음)
  - PKCE S256 적용됨, client_id는 observed 값이므로 성공 보장 안 됨
- `ai-usage-agent auth login codex --manual`
  - callback URL/code 입력을 받아 placeholder/mock 계정을 auth store에 저장
  - 아직 실제 OAuth token exchange는 아님

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
node packages/agent/bin/ai-usage-agent.js status
```

## 설정 파일

기본 설정 경로:

```text
~/.config/ai-usage-agent/config.json
```

현재 기본 설정에는 아래 항목이 들어간다:
- 출력 포맷
- sync 사용 여부
- provider 활성화 여부

## 현재 Codex 연동 방식

- OpenClaw auth profile 저장소를 읽음
- Codex usage endpoint를 bearer auth로 호출
- 응답을 공통 snapshot 구조로 변환
- 시간 필드는 ISO datetime string으로 정규화
- provider 원본값은 snapshot의 `raw`에 보존

## 예정 명령

- `ai-usage-agent inspect <provider>`
- `ai-usage-agent sync`
