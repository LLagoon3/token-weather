# 인증 저장소 스키마 초안

## 목표

`token-weather` 전용 credential store의 구조를 정의한다.

이 스키마는 OpenClaw auth store와 분리된 독립 저장소를 전제로 한다.

## 저장 위치 제안

기본 경로:

```text
~/.config/token-weather/auth.json
```

현재 기본 방안:

- 민감 토큰 포함 `auth.json` 파일 저장으로 시작
- 파일 권한은 `0600`을 기본으로 사용

향후 확장:

- OS keychain 저장
- 파일에는 메타데이터와 key reference만 저장

## 최상위 구조 예시

```json
{
  "version": 1,
  "updatedAt": "2026-04-13T03:00:00.000Z",
  "providers": {
    "openai-codex": {
      "accounts": [
        {
          "accountKey": "openai-codex:choonarm3@gmail.com",
          "email": "choonarm3@gmail.com",
          "displayName": null,
          "accountId": null,
          "authType": "oauth",
          "source": "agent-store",
          "createdAt": "2026-04-13T03:00:00.000Z",
          "updatedAt": "2026-04-13T03:10:00.000Z",
          "expiresAt": "2026-04-13T04:10:00.000Z",
          "scopes": [],
          "tokens": {
            "accessToken": "***",
            "refreshToken": "***"
          },
          "raw": {
            "provider": "openai-codex"
          }
        }
      ]
    }
  }
}
```

## 필드 설명

### 최상위

- `version`: 저장소 버전
- `updatedAt`: ISO datetime string
- `providers`: provider별 계정 묶음

### account

- `accountKey`: 내부 고유 키
- `email`: 계정 식별용 이메일
- `displayName`: 사용자 표시명
- `accountId`: provider별 계정 id
- `authType`: `oauth` / `session_cookie` / `session_key` / `api_key` / `unknown`
- `source`: `agent-store` / `openclaw-import` / `env` / `manual`
- `createdAt`, `updatedAt`, `expiresAt`: 모두 ISO datetime string
- `scopes`: OAuth scope 목록
- `tokens`: access/refresh token 저장 영역
- `raw`: provider 고유 메타데이터

## 보안 고려

초기 버전에서는 아래 두 가지 옵션 중 하나를 선택할 수 있다.

### 옵션 A. 단순 파일 저장

장점:

- 구현이 빠름
- 로컬 개발이 단순함

단점:

- 민감값 보호 수준이 낮음

### 옵션 B. 파일 + keychain 분리

장점:

- 운영 보안이 더 좋음
- 토큰 유출 위험을 낮춤

단점:

- 플랫폼별 구현이 늘어남

## 추천

초기 MVP는:

- `auth.json` 파일 저장으로 먼저 구현
- 파일 권한은 `0600`
- 토큰 필드는 추후 keychain 백엔드로 교체 가능하게 추상화

즉 스키마는 유지하고 저장 backend만 바꾸는 방식이 좋다.

## 추가 메타데이터 후보

필요 시 아래 필드 추가 가능:

- `lastRefreshAt`
- `lastUsedAt`
- `lastErrorAt`
- `lastErrorCode`
- `preferred`
- `disabled`
- `migration`: OpenClaw import 이력

## multi-account 기본 선택 규칙

- 계정이 1개면 자동 선택
- 계정이 여러 개면 `lastUsedAt`이 가장 최근인 active 계정 사용
- `--account user@example.com`으로 명시 지정 가능
- `auth list`에서 기본 선택 대상 계정은 `*`로 표시
