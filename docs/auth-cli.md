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

현재 구현 상태:
- localhost callback 준비 코드까지 동작
- 브라우저 자동 열기와 실제 token exchange는 아직 미구현
- `--manual`에서는 placeholder/mock 저장 흐름이 동작

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
- `--device`: 후순위 실험용 옵션, provider 지원 확인 전까지는 기본 경로로 사용하지 않음
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
- 현재 기본 선택될 계정이 무엇인지

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
- multi-account는 자동 선택 + 명시 override 방식으로 단순하게 유지

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

현재 출력/동작:
1. callback URL 전체 또는 code 입력 요청
2. placeholder/mock 계정을 auth store에 저장
3. 실제 OAuth 교환은 아직 수행하지 않음

## 포트 충돌 정책

- 기본 포트는 예: `19876`
- 포트 충돌 시 `19877`, `19878` 순으로 최대 3회 자동 재시도
- 3회 모두 실패하면 manual paste 모드로 자동 전환
- 사용자가 `--port`를 명시한 경우는 해당 포트만 시도하고 실패 시 에러 반환

## multi-account 정책

- 계정이 1개면 자동 선택
- 계정이 여러 개면 `lastUsedAt`이 가장 최근인 active 계정 사용
- `--account`로 명시 지정 가능

## 아직 미정인 부분

- revoke endpoint를 각 provider에서 어디까지 지원할지
- `auth import openclaw`를 기본 노출할지 숨길지
- device code를 실제로 도입할 provider 범위
