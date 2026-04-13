# Auth CLI 인터페이스 초안

## 목표

`ai-usage-agent`가 OpenClaw 없이도 자체 인증을 수행할 수 있도록 auth 관련 CLI 명령 집합을 정의한다.

## 기본 명령 구조

```text
ai-usage-agent auth <subcommand> [provider] [options]
```

## 우선 구현 후보

### 1. login

```bash
ai-usage-agent auth login codex
```

기본 동작:
- localhost callback OAuth 시도
- 브라우저 자동 열기 시도
- 성공 시 token 저장

옵션 예시:

```bash
ai-usage-agent auth login codex --no-open
ai-usage-agent auth login codex --manual
ai-usage-agent auth login codex --device
ai-usage-agent auth login codex --port 38123
```

옵션 의미:
- `--no-open`: 브라우저 자동 실행 안 함
- `--manual`: callback URL 또는 code 수동 입력 흐름 강제
- `--device`: device code flow 강제 시도
- `--port`: localhost callback 포트 지정

### 2. list

```bash
ai-usage-agent auth list
ai-usage-agent auth list codex
```

출력 예시:
- provider
- accountKey
- email
- authType
- expiresAt
- source

### 3. logout

```bash
ai-usage-agent auth logout codex
ai-usage-agent auth logout codex --account choonarm3@gmail.com
```

동작:
- 저장소에서 해당 계정 제거
- 필요 시 revoke endpoint 지원 가능

### 4. doctor

```bash
ai-usage-agent auth doctor
ai-usage-agent auth doctor codex
```

점검 항목:
- auth store 존재 여부
- provider 계정 존재 여부
- expiresAt 만료 여부
- refresh 가능 여부
- callback 포트/환경 문제 힌트

### 5. import

```bash
ai-usage-agent auth import openclaw
```

목적:
- 기존 OpenClaw 사용자의 migration 지원
- 런타임 기본 의존이 아니라 초기 전환 도구로만 제공

## 추천 UX 원칙

- 기본 명령은 최대한 짧게
- 세부 제어는 옵션으로 열기
- 실패 시 단순한 에러 대신 다음 행동을 안내
- headless 환경을 위한 fallback 경로를 명확히 제공

## 예시 시나리오

### 일반 데스크톱 환경

```bash
ai-usage-agent auth login codex
```

출력:
1. 브라우저를 여는 중...
2. 로그인 완료 후 callback 수신 대기...
3. 저장 완료

### SSH / 원격 환경

```bash
ai-usage-agent auth login codex --manual --no-open
```

출력:
1. 아래 URL을 브라우저에서 열어주세요
2. 완료 후 callback URL 전체를 붙여넣어 주세요
3. 저장 완료

## 아직 미정인 부분

- `login` 성공 후 기본 계정 선택 UX
- multi-account가 많은 경우 interactive picker 필요 여부
- revoke endpoint를 각 provider에서 어디까지 지원할지
- `auth import openclaw`를 기본 노출할지 숨길지
