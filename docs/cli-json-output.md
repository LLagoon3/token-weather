# CLI JSON 출력 (`--json`)

`status` / `usage` 커맨드는 `--json` 플래그로 정규화된 JSON 한 줄을 stdout에 출력한다. 자동화 / 대시보드 / 백엔드 수집기가 텍스트 포매팅을 다시 파싱하지 않고 직접 소비할 수 있도록 한 명세다.

이 문서는 출력 shape의 **stable contract**다. 변경 시 schema bump이 필요하다(현재 `schemaVersion`은 `packages/schemas`와 공유).

## 사용

```bash
ai-usage-agent status --json
ai-usage-agent usage  --json
ai-usage-agent status --json --provider codex
ai-usage-agent status --json --account work@example.com --provider claude
```

- stdout에는 **JSON 한 줄**만 흐른다 (개행 1개로 종료).
- 안내·경고·실패 메시지는 stderr로 흐른다 (자동화는 stdout만 파싱하면 된다).
- 알 수 없는 `--provider` 입력은 기존 텍스트 모드와 동일하게 stderr 메시지 + `exit 1`. JSON으로 fallback하지 않는다 (호출자가 명시적으로 실패를 인지하도록).

## Top-level shape

```json
{
  "command": "status",
  "generatedAt": "2026-04-25T08:30:00.000Z",
  "schemaVersion": 1,
  "configPath": "/home/user/.config/ai-usage-agent/config.json",
  "accountFilter": null,
  "providerFilter": null,
  "providers": [
    { "id": "codex",  "snapshot": { ... } },
    { "id": "claude", "snapshot": { ... } }
  ]
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `command` | `"status"` \| `"usage"` | 호출된 커맨드 이름. |
| `generatedAt` | ISO-8601 string | snapshot 직렬화 시각(client-side). |
| `schemaVersion` | int \| null | `packages/schemas/src/index.js::SCHEMA_VERSION`을 그대로 통과. |
| `configPath` | string \| null | resolved config 파일 경로. |
| `accountFilter` | string \| null | `--account <id>` 입력 (case-insensitive 매치는 별도). |
| `providerFilter` | string \| null | `--provider <id>` 입력. lowercase 정규화된 값. |
| `providers` | array | 아래 §providers 참고. |

## providers

`providers`는 `[{ id, snapshot }]` 배열이다. `id`는 registry id(`codex` / `claude`)로, `--provider`가 받는 값과 동일.

`providerFilter`가 지정되면 매칭되는 provider만 배열에 포함된다 (다른 provider는 snapshot 자체가 만들어지지 않으므로 누락). 미지정 시 등록 순서대로 모두 포함.

`snapshot`은 각 provider builder(`getCodexSnapshot` / `getClaudeSnapshot`)가 반환하는 객체에서 **민감 키를 제거한 deep clone**이다.

### 제거되는 민감 키 (redaction)

다음 key가 객체 / 배열 어느 깊이에 있든 출력에서 빠진다 (전체 subtree 제거):

- `accessToken`, `refreshToken`, `idToken`, `tokens`
- `sessionKey`, `sessionCookie`
- `codeVerifier`, `client_secret`

추가되는 토큰성 필드는 `packages/agent/src/cli/status-json.js::SENSITIVE_KEYS`에 등록한다. 신규 provider 추가 시 토큰 필드 명을 이 목록과 맞춰야 자동으로 redact된다.

## 안정성

- 신규 키 추가는 **non-breaking** (소비자는 unknown 필드 무시 권장).
- 키 제거 / 의미 변경 / shape 재구성은 **breaking** — `schemaVersion` 증가가 필요.
- `providers[].id` 식별자는 `PROVIDER_REGISTRY`와 동기화되며, 추가/삭제는 schema bump 사유.

## 보안 원칙

- 토큰류는 stdout/stderr 어느 곳으로도 출력 금지 (텍스트 모드도 동일).
- `--json` 모드는 redaction을 거치므로 logging 파이프라인 또는 외부 시스템에 그대로 보내도 안전한 contract를 목표로 한다.
- 추가로 `raw` 같은 자유 형식 필드를 도입할 때는 토큰 누출 여부를 케이스별로 검토한다.
