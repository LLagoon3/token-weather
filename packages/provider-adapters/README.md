# provider-adapters

provider별 인증 소스, usage endpoint, 응답 정규화 로직을 모아두는 패키지.

## 현재 구현 상태

현재는 Codex adapter가 구현되어 있다.

구현된 것:
- OpenClaw auth profile 파일에서 Codex OAuth 프로필 읽기
- `https://chatgpt.com/backend-api/wham/usage` 호출
- 선택적 `ChatGPT-Account-Id` 헤더 지원
- 공통 `usage snapshot` 형태로 결과 정규화
- provider 원본 응답을 `raw` 필드에 보존
- Codex auth metadata/constants 및 authorization URL generation 골격

## 현재 구조

```text
src/
  codex/
    codex-auth-constants.js
    build-codex-authorization-url.js
    read-codex-auth-profiles.js
    fetch-codex-usage.js
    index.js
  index.js
```

## Codex adapter 요약

### auth source
기본적으로 아래 경로를 읽는다:

```text
~/.openclaw/agents/main/agent/auth-profiles.json
```

여기서:
- `provider === "openai-codex"`
- `type === "oauth"`

인 프로필만 추출한다.

### endpoint
```text
https://chatgpt.com/backend-api/wham/usage
```

### normalized output
현재 출력은 `packages/schemas/usage-snapshot.schema.json` 방향을 따르는 snapshot 구조다.

주요 필드:
- `provider`
- `account`
- `source`
- `authType`
- `confidence`
- `status`
- `usageWindows`
- `credits`
- `raw`

## 다음 예정

- Claude adapter 추가
- 공통 event 변환 추가
- auth/account edge case 정리
- schema validation 연결
