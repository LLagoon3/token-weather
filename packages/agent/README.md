# agent

로컬 환경에서 AI 서비스 usage/quota 상태를 수집하고 CLI로 보여주는 패키지.

## 목표

- 로컬 auth/session을 활용해 provider usage endpoint를 호출
- usage snapshot과 이벤트를 공통 포맷으로 정규화
- 터미널에서 즉시 확인 가능하게 출력
- 필요 시 서버로 업로드 가능하게 확장

## 예정 명령

- `ai-usage-agent status`
- `ai-usage-agent usage`
- `ai-usage-agent inspect <provider>`
- `ai-usage-agent sync`
- `ai-usage-agent doctor`
- `ai-usage-agent config init`
