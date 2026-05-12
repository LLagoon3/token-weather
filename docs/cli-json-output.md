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
  "schemaVersion": "0.5.0",
  "configPath": "/home/user/.config/token-weather/config.json",
  "accountFilter": null,
  "providerFilter": null,
  "providers": [
    { "id": "codex",  "snapshot": { ... } },
    { "id": "claude", "snapshot": { ... } }
  ]
}
```

| 필드             | 타입                    | 부재 시                               | 설명                                                                                                                                                                         |
| ---------------- | ----------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command`        | `"status"` \| `"usage"` | 항상 present                          | 호출된 커맨드 이름.                                                                                                                                                          |
| `generatedAt`    | ISO-8601 string         | 항상 present                          | snapshot 직렬화 시각(client-side).                                                                                                                                           |
| `schemaVersion`  | string semver \| null   | 항상 present (값이 null 일 수는 있음) | `packages/schemas/src/index.js::SCHEMA_VERSION`(현재 `'0.5.0'`)을 그대로 통과. 패키지 `version`과는 독립이며 bump 트리거는 [docs/release-policy.md §3](./release-policy.md). |
| `configPath`     | string \| null          | 항상 present                          | resolved config 파일 경로.                                                                                                                                                   |
| `accountFilter`  | string \| null          | 미지정 시 `null` (키 부재 아님)       | `--account <id>` 입력 (case-insensitive 매치는 별도).                                                                                                                        |
| `providerFilter` | string \| null          | 미지정 시 `null` (키 부재 아님)       | `--provider <id>` 입력. lowercase 정규화된 값.                                                                                                                               |
| `providers`      | array                   | 항상 present (`[]` 가능)              | 아래 §providers 참고.                                                                                                                                                        |

### 필드 부재 정책 — null vs 키 부재

본 contract 의 모든 상위·하위 필드는 **부재 시에도 명시적으로 `null`** (또는 빈 array/object) 로 노출된다. 즉 `if (key in data)` 패턴은 안전하지 않으며 (모든 정의된 키는 항상 present), 값이 `null` 인지 확인하는 게 정합:

```js
// before — 키 부재 분기 (불필요)
if ('accountFilter' in data) {
  /* ... */
}

// after — 값이 null 인지 확인
if (data.accountFilter !== null) {
  /* ... */
}
```

`providers[].snapshot.usageSnapshots` 도 빈 배열 `[]` 으로 노출되지 키 자체가 부재하지는 않는다. 신규 키 추가 시에도 이 정책을 따라 항상 default value 를 명시.

## providers

`providers`는 `[{ id, snapshot }]` 배열이다. `id`는 registry id(`codex` / `claude`)로, `--provider`가 받는 값과 동일.

`providerFilter`가 지정되면 매칭되는 provider만 배열에 포함된다 (다른 provider는 snapshot 자체가 만들어지지 않으므로 누락). 미지정 시 등록 순서대로 모두 포함.

`snapshot`은 각 provider builder(`getCodexSnapshot` / `getClaudeSnapshot`)가 반환하는 객체에서 **민감 키를 제거한 deep clone**이다.

### Provider entry shape (v0.5.0, symmetric)

v0.5.0 (issue #120) 부터 codex / claude provider snapshot 의 키셋이 **동일**하다. 외부 consumer 는 provider 분기 없이 단일 path 로 데이터를 조회할 수 있다.

| 필드              | 타입                 | 설명                                                                                                                                 |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`         | boolean              | `config.providers.<id>.enabled` 통과. provider 가 호출 대상인지.                                                                     |
| `authSource`      | string               | `'agent-store'` / `'codex-cli-import'` / `'claude-cli-import'` / `'not-found'` 중 하나.                                              |
| `credentialsPath` | string \| null       | `cli-import` 인증 소스 시점에만 경로. 그 외엔 `null` (codex / claude 동일 정책).                                                     |
| `usageSnapshots`  | Array<UsageSnapshot> | 계정별 usage snapshot 직접 배열. element shape 는 [usage-snapshot.schema.json](../packages/schemas/usage-snapshot.schema.json) 정합. |
| `accountFilter`   | string \| null       | `--account` 입력 그대로 통과 (case-insensitive 매치는 별도).                                                                         |
| `filteredOut`     | boolean              | filter 가 지정됐는데 매칭되는 계정이 없었는지.                                                                                       |

### `authSource` enum 값

| 값                    | 의미                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `'agent-store'`       | `~/.config/token-weather/auth.json` (token-weather 자체 store) 에서 active 계정을 찾음.                         |
| `'codex-cli-import'`  | (codex 만) `~/.codex/auth.json` (Codex CLI 자체) 에서 폴백 import. `credentialsPath` 가 함께 노출됨.            |
| `'claude-cli-import'` | (claude 만) `~/.claude/.credentials.json` (Claude CLI 자체) 에서 폴백 import. `credentialsPath` 가 함께 노출됨. |
| `'not-found'`         | 어느 소스에서도 active 계정을 찾지 못함. `credentialsPath` 는 `null`.                                           |

값 enum 변경 (추가 / 제거 / 의미 변경) 은 [release-policy §1](./release-policy.md) 의 major 트리거 — `SCHEMA_VERSION` bump 필요.

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

### `raw` 영역 책임 (provider adapter 계약)

`usageSnapshots[].raw` 는 provider 별 응답 원본을 보존하는 free-form subtree 다. `additionalProperties: true` 로 schema 가 열려있어 redaction 의 key-name match 가 미치지 못하는 위험 지대.

**provider adapter 의 책임**:

1. **token 값을 raw 의 free-form 키에 복사하지 않는다.** 응답에서 `access_token` / `refresh_token` 같은 SENSITIVE_KEYS 매칭 키로만 들어오면 redaction 이 처리하지만, `body`/`response`/`payload` 같은 키 안에 token 값 문자열이 들어가면 그대로 누출.
2. **응답 본문 전체를 raw 에 dump 하지 않는다.** 필요한 필드만 명시적으로 발췌 — 예: `raw: { provider, plan, ...selectedFields }`.
3. **새 토큰 패턴 식별자가 발견되면 `SENSITIVE_KEYS` 에 등록 PR.**

위 책임은 코드 리뷰 + 회귀 가드 (`status-json.test.js` 의 redaction 단위 테스트) 로 강제.

## 안정성

- 신규 키 추가는 **non-breaking** (소비자는 unknown 필드 무시 권장).
- 키 제거 / 의미 변경 / shape 재구성은 **breaking** — `schemaVersion` 증가가 필요.
- `providers[].id` 식별자는 `PROVIDER_REGISTRY`와 동기화되며, 추가/삭제는 schema bump 사유.

## 제거된 backward-compat alias (v0.4.0)

v0.4.0 (issue #119) 에서 claude provider snapshot 의 alias 3 종이 제거됐다. 외부 consumer 가 alias 키를 파싱하고 있었다면 정식 키로 마이그레이션 필요.

| 제거된 alias                                     | 정식 키                                        | 비고                                                                              |
| ------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `.providers[].snapshot.networkUsage` (단일 객체) | `.providers[].snapshot.networkUsages[]` (배열) | **원소 wrapper 주의** — 아래 참고. 단일 계정은 `[0]`, multi-account 는 `[]` 순회. |
| `.providers[].snapshot.importedAccount`          | `.providers[].snapshot.selectedAccount`        | 동일 값이었음.                                                                    |
| `.providers[].snapshot.parsed`                   | `.providers[].snapshot.found`                  | 항상 `found` 와 동일 값이었음.                                                    |

이전 버전 (v0.3.x 이하) 에서는 두 키가 함께 출력되어 backward-compat 가 유지됐으나, v0.4.0 부터는 정식 키만 노출.

## Provider shape symmetry (v0.5.0)

v0.5.0 (issue #120) 에서 codex / claude provider snapshot 의 키 이름이 통일되고 claude 의 wrapper 패턴이 제거됐다.

| 영역               | v0.4.x 이하 (Codex)             | v0.4.x 이하 (Claude)                        | v0.5.0+ (양 provider 동일)                                    |
| ------------------ | ------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| usage 배열 키      | `snapshots[]`                   | `networkUsages[]`                           | **`usageSnapshots[]`**                                        |
| usage 배열 element | `UsageSnapshot` 직접            | `{ accountKey, account, snapshot }` wrapper | **`UsageSnapshot` 직접** (wrapper 제거)                       |
| 활성 여부          | `enabled: bool`                 | `detected` / `found` (2 키)                 | **`enabled: bool`** (단일)                                    |
| 기본 계정          | (없음)                          | `selectedAccount`                           | (없음, 양 provider 모두 제거)                                 |
| credentialsPath    | `cli-import` 시점만 (null 아님) | 항상 (절대 null 아님)                       | **`cli-import` 시점만**, 그 외 `null` (양 provider 동일 정책) |

### Migration (v0.4.x → v0.5.0)

```js
// before (v0.4.x)
const codexEnabled = data.providers.find((p) => p.id === 'codex').snapshot.enabled;
const codexSnaps = data.providers.find((p) => p.id === 'codex').snapshot.snapshots;
const claudeEnabled = data.providers.find((p) => p.id === 'claude').snapshot.detected;
const claudeFound = data.providers.find((p) => p.id === 'claude').snapshot.found;
const claudeWindows = data.providers.find((p) => p.id === 'claude').snapshot.networkUsages[0]
  .snapshot.usageWindows;
const claudeAccount = data.providers.find((p) => p.id === 'claude').snapshot.selectedAccount;

// after (v0.5.0+) — codex / claude 동일 path
const provider = (id) => data.providers.find((p) => p.id === id).snapshot;
const codexEnabled = provider('codex').enabled;
const codexSnaps = provider('codex').usageSnapshots;
const claudeEnabled = provider('claude').enabled;
//   found / detected: 의미가 약간 다른데, "credential 이 어디서든 발견됐는지" 는 enabled 와 같음.
//   순수 credential 파일 존재 확인은 credentialsPath 가 null 인지로 대체 가능.
const claudeWindows = provider('claude').usageSnapshots[0].usageWindows;
//   wrapper 제거 — `.snapshot` 단계 더 이상 없음.
const claudeAccount = provider('claude').usageSnapshots.find(/* by criteria */)?.account;
//   default account 개념 제거 — 필요시 usageSnapshots[] 순회로 식별.
```

### `networkUsages[]` 원소 구조 (v0.4.x 기준 — v0.5.0 에서 제거됨)

> **v0.5.0 (issue #120) 갱신**: `networkUsages[]` 자체가 `usageSnapshots[]` 로 rename 되었고, wrapper `{ accountKey, account, snapshot }` 도 unwrap 되어 **UsageSnapshot 직접** 으로 들어간다. 즉 v0.5.0+ 에서는 아래의 wrapper 단계가 사라져 `.snapshot.usageWindows` → `.usageWindows` 로 한 단계 짧아짐. 위 §"Provider shape symmetry (v0.5.0)" 의 Migration 참고.

이전 (v0.3.x) `networkUsage` (단일) 는 usage snapshot **객체 그대로** 였지만, v0.4.x 의 `networkUsages[]` 의 각 원소는 `{ accountKey, account, snapshot }` **wrapper**였다. 실제 `usageWindows` / `status` 등 데이터는 `.snapshot` 안에 있었음.

```js
// before (v0.3.x — 제거됨)
const ok = data.providers.find((p) => p.id === 'claude').snapshot.networkUsage.status.ok;
const windows = data.providers.find((p) => p.id === 'claude').snapshot.networkUsage.usageWindows;

// after (v0.4.0+)
const claude = data.providers.find((p) => p.id === 'claude').snapshot;
const ok = claude.networkUsages[0].snapshot.status.ok; // ← .snapshot 단계 추가
const windows = claude.networkUsages[0].snapshot.usageWindows;

// 다 계정 순회 패턴
for (const entry of claude.networkUsages) {
  console.log(entry.accountKey, entry.snapshot.status.ok); // ← entry.snapshot
}
```

## 보안 원칙

- 토큰류는 stdout/stderr 어느 곳으로도 출력 금지 (텍스트 모드도 동일).
- `--json` 모드는 redaction을 거치므로 logging 파이프라인 또는 외부 시스템에 그대로 보내도 안전한 contract를 목표로 한다.
- 추가로 `raw` 같은 자유 형식 필드를 도입할 때는 토큰 누출 여부를 케이스별로 검토한다.
