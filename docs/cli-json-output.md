# CLI JSON 출력 (`--json`)

`status` / `usage` 커맨드는 `--json` 플래그로 정규화된 JSON 한 줄을 stdout에 출력한다. 자동화 / 대시보드 / 백엔드 수집기가 텍스트 포매팅을 다시 파싱하지 않고 직접 소비할 수 있도록 한 명세다.

이 문서는 출력 shape의 **stable contract**다. 변경 시 schema bump이 필요하다(현재 `schemaVersion`은 `packages/schemas`와 공유 — string semver, [docs/release-policy.md §3](./release-policy.md) 참고).

## 사용

```bash
token-weather status --json
token-weather usage  --json
token-weather status --json --provider codex
token-weather status --json --account work@example.com --provider claude
```

- stdout에는 **JSON 한 줄**만 흐른다 (개행 1개로 종료).
- 안내·경고·실패 메시지는 stderr로 흐른다 (자동화는 stdout만 파싱하면 된다).
- 알 수 없는 `--provider` 입력은 기존 텍스트 모드와 동일하게 stderr 메시지 + `exit 1`. JSON으로 fallback하지 않는다 (호출자가 명시적으로 실패를 인지하도록).

## Top-level shape

```json
{
  "command": "status",
  "generatedAt": "2026-04-25T08:30:00.000Z",
  "schemaVersion": "0.4.0",
  "configPath": "/home/user/.config/token-weather/config.json",
  "accountFilter": null,
  "providerFilter": null,
  "providers": [
    { "id": "codex",  "snapshot": { ... } },
    { "id": "claude", "snapshot": { ... } }
  ]
}
```

| 필드             | 타입                    | 설명                                                                                                                                                                         |
| ---------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command`        | `"status"` \| `"usage"` | 호출된 커맨드 이름.                                                                                                                                                          |
| `generatedAt`    | ISO-8601 string         | snapshot 직렬화 시각(client-side).                                                                                                                                           |
| `schemaVersion`  | string semver \| null   | `packages/schemas/src/index.js::SCHEMA_VERSION`(현재 `'0.4.0'`)을 그대로 통과. 패키지 `version`과는 독립이며 bump 트리거는 [docs/release-policy.md §3](./release-policy.md). |
| `configPath`     | string \| null          | resolved config 파일 경로.                                                                                                                                                   |
| `accountFilter`  | string \| null          | `--account <id>` 입력 (case-insensitive 매치는 별도).                                                                                                                        |
| `providerFilter` | string \| null          | `--provider <id>` 입력. lowercase 정규화된 값.                                                                                                                               |
| `providers`      | array                   | 아래 §providers 참고.                                                                                                                                                        |

## providers

`providers`는 `[{ id, snapshot }]` 배열이다. `id`는 registry id(`codex` / `claude`)로, `--provider`가 받는 값과 동일.

`providerFilter`가 지정되면 매칭되는 provider만 배열에 포함된다 (다른 provider는 snapshot 자체가 만들어지지 않으므로 누락). 미지정 시 등록 순서대로 모두 포함.

`snapshot`은 각 provider builder(`getCodexSnapshot` / `getClaudeSnapshot`)가 반환하는 객체에서 **민감 키를 제거한 deep clone**이다.

### 제거되는 민감 키 (redaction)

다음 key가 객체 / 배열 어느 깊이에 있든 출력에서 빠진다 (전체 subtree 제거).
매칭은 **case-insensitive** (`AccessToken` / `ACCESSTOKEN` 모두 동일하게 차단).

- OAuth tokens (camelCase + snake_case): `accessToken`, `refreshToken`, `idToken`, `tokens`, `access_token`, `refresh_token`, `id_token`
- OAuth client secret / verifier: `client_secret`, `clientSecret`, `codeVerifier`, `code_verifier`
- Session / cookie 자료: `sessionKey`, `sessionCookie`, `session_key`, `session_cookie`
- HTTP credential 헤더: `authorization`, `cookie`
- 일반 API key / password: `apiKey`, `api_key`, `password`

신규 provider/스키마가 새 토큰 필드를 도입할 때는 `packages/agent/src/cli/status-json.js::SENSITIVE_KEYS`에 함께 등록한다.

### 한계 (key-name match list, value detector 아님)

본 redaction은 **정확한 key 이름**을 기준으로 동작한다(case-insensitive 비교는 하지만 정규식이나 값 패턴 검사는 하지 않는다). 즉:

- 위 목록에 없는 이름으로 토큰성 데이터가 들어오면 자동으로 걸러지지 **않는다** (예: `bearer`, `access-key`, `secretToken` 등 신규 식별자).
- 객체의 `raw` / `meta` 같은 자유 형식 subtree에 토큰을 직렬로 넣지 말 것 — 또는 SENSITIVE_KEYS에 해당 이름을 등록할 것.
- JWT 같은 값 패턴이 `notes`나 `description` 같은 임의 키에 박혀 들어오면 redact되지 않는다 — provider adapter 단에서 토큰 값을 그런 자유 필드에 복사하지 않도록 책임이 있다.

이 한계는 `--json` contract가 *값 검사기*가 아닌 *명시적 명시 누출 차단기*라는 설계상의 결정이다. 새 식별자가 발견되면 PR로 SENSITIVE_KEYS를 갱신하면 된다.

## 안정성

- 신규 키 추가는 **non-breaking** (소비자는 unknown 필드 무시 권장).
- 키 제거 / 의미 변경 / shape 재구성은 **breaking** — `schemaVersion` 증가가 필요.
- `providers[].id` 식별자는 `PROVIDER_REGISTRY`와 동기화되며, 추가/삭제는 schema bump 사유.

## 제거된 backward-compat alias (v0.4.0)

v0.4.0 (issue #119) 에서 claude provider snapshot 의 alias 3 종이 제거됐다. 외부 consumer 가 alias 키를 파싱하고 있었다면 정식 키로 마이그레이션 필요.

| 제거된 alias                                     | 정식 키                                        | 비고                                                                           |
| ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `.providers[].snapshot.networkUsage` (단일 객체) | `.providers[].snapshot.networkUsages[]` (배열) | 단일 계정 케이스는 `networkUsages[0]`. multi-account 도 `[]` 순회로 일관 처리. |
| `.providers[].snapshot.importedAccount`          | `.providers[].snapshot.selectedAccount`        | 동일 값이었음.                                                                 |
| `.providers[].snapshot.parsed`                   | `.providers[].snapshot.found`                  | 항상 `found` 와 동일 값이었음.                                                 |

이전 버전 (v0.3.x 이하) 에서는 두 키가 함께 출력되어 backward-compat 가 유지됐으나, v0.4.0 부터는 정식 키만 노출.

## 보안 원칙

- 토큰류는 stdout/stderr 어느 곳으로도 출력 금지 (텍스트 모드도 동일).
- `--json` 모드는 redaction을 거치므로 logging 파이프라인 또는 외부 시스템에 그대로 보내도 안전한 contract를 목표로 한다.
- 추가로 `raw` 같은 자유 형식 필드를 도입할 때는 토큰 누출 여부를 케이스별로 검토한다.
