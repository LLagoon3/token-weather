# CLI JSON output (`--json`)

🌐 **English** · [한국어](./cli-json-output.md)

> Translated from [cli-json-output.md](./cli-json-output.md) — last sync 2026-05-20. The Korean version is the source of truth; this English version follows it. See [CONTRIBUTING.md §10](../CONTRIBUTING.md) for the i18n drift policy.

The `status` / `usage` commands emit a single normalized JSON line to stdout when given the `--json` flag. This is a specification so that automation / dashboards / backend collectors can consume the output directly without re-parsing text formatting.

This document is the **stable contract** for the output shape. Changes require a schema bump (the current `schemaVersion` is shared with `packages/schemas` — a string semver, see [docs/release-policy.md §3](./release-policy.md)).

## Usage

```bash
token-weather status --json
token-weather usage  --json
token-weather status --json --provider codex
token-weather status --json --account work@example.com --provider claude
```

- stdout carries **only one JSON line** (terminated by a single newline).
- Notices / warnings / failure messages go to stderr (automation only needs to parse stdout).
- Unknown `--provider` input behaves like text mode — stderr message + `exit 1`. It does **not** fall back to JSON (so the caller is forced to recognize the failure explicitly).

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

| Field            | Type                    | When absent                              | Description                                                                                                                                                                                     |
| ---------------- | ----------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command`        | `"status"` \| `"usage"` | Always present                           | The invoked command name.                                                                                                                                                                       |
| `generatedAt`    | ISO-8601 string         | Always present                           | Time the snapshot was serialized (client-side).                                                                                                                                                 |
| `schemaVersion`  | string semver \| null   | Always present (value may be null)       | Passed through from `packages/schemas/src/index.js::SCHEMA_VERSION` (currently `'0.5.0'`). Independent of package `version`; bump triggers in [docs/release-policy.md §3](./release-policy.md). |
| `configPath`     | string \| null          | Always present                           | Resolved config file path.                                                                                                                                                                      |
| `accountFilter`  | string \| null          | `null` when unspecified (key not absent) | `--account <id>` input as given (case-insensitive matching is handled separately).                                                                                                              |
| `providerFilter` | string \| null          | `null` when unspecified (key not absent) | `--provider <id>` input, lowercase-normalized.                                                                                                                                                  |
| `providers`      | array                   | Always present (`[]` possible)           | See §providers below.                                                                                                                                                                           |

### Field-absence policy — null vs missing key

Scope:

- **Top-level defined fields** (`command` / `generatedAt` / `schemaVersion` / `configPath` / `accountFilter` / `providerFilter` / `providers`) — **always present**. When there is no value, it appears as an explicit `null` (or empty array `[]`); the key itself is never absent.
- **Defined fields on a provider snapshot in `providers[]`** (`enabled` / `authSource` / `credentialsPath` / `usageSnapshots` / `accountFilter` / `filteredOut`) — **always with an explicit default value**. Absent values appear as `null` / `[]` / `false` etc.

**Exception**: when only some providers are requested via `--provider <id>`, **the entries for unselected providers are not included in `providers[]` at all** (no snapshot is created). E.g., with `--provider codex`, the `claude` entry is missing from the array.

```js
// Top-level field: check the value (avoid the `'key' in data` anti-pattern)
if (data.accountFilter !== null) {
  /* ... */
}

// Provider entry presence: reflects providerFilter
const claude = data.providers.find((p) => p.id === 'claude');
if (claude) {
  // defined fields on claude.snapshot always have a default
  if (claude.snapshot.usageSnapshots.length > 0) {
    /* ... */
  }
}
```

When adding new keys, follow this policy — always specify a default value (no `undefined` and no missing key).

## providers

`providers` is an array of `[{ id, snapshot }]`. `id` is the registry id (`codex` / `claude`), matching what `--provider` accepts.

If `providerFilter` is specified, only matching providers are included in the array (snapshots for others are not even created, so the entries are absent). Otherwise all providers are included in registration order.

`snapshot` is a **deep clone with sensitive keys removed** of the object returned by each provider builder (`getCodexSnapshot` / `getClaudeSnapshot`).

### Provider entry shape (v0.5.0, symmetric)

Since v0.5.0 (issue #120), the keysets of codex / claude provider snapshots are **identical**. External consumers can query the data on a single path without branching by provider.

| Field             | Type                 | Description                                                                                                                                        |
| ----------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`         | boolean              | Pass-through of `config.providers.<id>.enabled`. Whether the provider is a call target.                                                            |
| `authSource`      | string               | One of `'agent-store'` / `'codex-cli-import'` / `'claude-cli-import'` / `'not-found'`.                                                             |
| `credentialsPath` | string \| null       | Set only when the auth source is `cli-import`. `null` otherwise (same policy for codex / claude).                                                  |
| `usageSnapshots`  | Array<UsageSnapshot> | Per-account usage snapshots as a direct array. Element shape matches [usage-snapshot.schema.json](../packages/schemas/usage-snapshot.schema.json). |
| `accountFilter`   | string \| null       | Pass-through of `--account` (case-insensitive matching is handled separately).                                                                     |
| `filteredOut`     | boolean              | Whether a filter was specified but no matching account was found.                                                                                  |

### `authSource` enum values

| Value                 | Meaning                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `'agent-store'`       | Found an active account in `~/.config/token-weather/auth.json` (token-weather's own store).                             |
| `'codex-cli-import'`  | (codex only) Fallback-imported from `~/.codex/auth.json` (Codex CLI itself). `credentialsPath` is exposed alongside.    |
| `'claude-cli-import'` | (claude only) Fallback-imported from `~/.claude/.credentials.json` (Claude CLI itself). `credentialsPath` is alongside. |
| `'not-found'`         | No active account found in any source. `credentialsPath` is `null`.                                                     |

Changing the enum (add / remove / meaning change) is a major-bump trigger per [release-policy §1](./release-policy.md) — `SCHEMA_VERSION` bump required.

### Sensitive keys removed (redaction)

The following keys are dropped from the output at any depth, in objects or arrays (the entire subtree is removed).
Matching is **case-insensitive** (`AccessToken` / `ACCESSTOKEN` are equally blocked).

- OAuth tokens (camelCase + snake_case): `accessToken`, `refreshToken`, `idToken`, `tokens`, `access_token`, `refresh_token`, `id_token`
- OAuth client secret / verifier: `client_secret`, `clientSecret`, `codeVerifier`, `code_verifier`
- Session / cookie material: `sessionKey`, `sessionCookie`, `session_key`, `session_cookie`
- HTTP credential headers: `authorization`, `cookie`
- Generic API key / password: `apiKey`, `api_key`, `password`

When a new provider/schema introduces new token-bearing fields, register them in `packages/agent/src/cli/status-json.js::SENSITIVE_KEYS` at the same time.

### Limits (key-name match list, not a value detector)

This redaction operates by **exact key name** (case-insensitive comparison, no regex / no value pattern detection). That means:

- Tokens delivered under a name not in the list above are **not** automatically filtered (e.g., new identifiers like `bearer`, `access-key`, `secretToken`).
- Don't serialize tokens into free-form subtrees like `raw` / `meta` — or register the relevant name in SENSITIVE_KEYS.
- A JWT-like value pattern stuck into arbitrary keys like `notes` or `description` is not redacted — the provider adapter is responsible for not copying token values into such free-form fields.

This limit is a design decision: the `--json` contract is an _explicit leak blocker_, not a _value detector_. When a new identifier is found, update SENSITIVE_KEYS via a PR.

### The `raw` area's responsibility (provider adapter contract)

`usageSnapshots[].raw` is a free-form subtree that preserves the provider's response. The schema has `additionalProperties: true`, so it's a danger zone where the key-name-match redaction cannot reach.

**The provider adapter's responsibility**:

1. **Do not copy token values into free-form keys in `raw`.** If they come in through SENSITIVE_KEYS-matching keys like `access_token` / `refresh_token`, redaction handles them — but if a token string lands in a key like `body`/`response`/`payload`, it leaks as-is.
2. **Do not dump the entire response body into `raw`.** Extract only the necessary fields explicitly — e.g., `raw: { provider, plan, ...selectedFields }`.
3. **When a new token-pattern identifier is found, file a PR to register it in `SENSITIVE_KEYS`.**

These responsibilities are enforced by code review + a regression guard (the redaction unit tests in `status-json.test.js`).

## Stability

- Adding new keys is **non-breaking** (consumers are advised to ignore unknown fields).
- Removing keys / changing meaning / restructuring shape is **breaking** — requires a `schemaVersion` bump.
- The `providers[].id` identifier stays in sync with `PROVIDER_REGISTRY`; adding/removing is a schema-bump reason.

## Removed backward-compat aliases (v0.4.0)

In v0.4.0 (issue #119), three aliases on the claude provider snapshot were removed. External consumers that parsed alias keys need to migrate to the official keys.

| Removed alias                                        | Official key                                    | Note                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `.providers[].snapshot.networkUsage` (single object) | `.providers[].snapshot.networkUsages[]` (array) | **Mind the element wrapper** — see below. Single-account uses `[0]`; multi-account iterates the array. |
| `.providers[].snapshot.importedAccount`              | `.providers[].snapshot.selectedAccount`         | The values were identical.                                                                             |
| `.providers[].snapshot.parsed`                       | `.providers[].snapshot.found`                   | Always had the same value as `found`.                                                                  |

In earlier versions (v0.3.x and below), both keys were emitted in parallel for backward-compat. Since v0.4.0, only the official keys are exposed.

## Provider shape symmetry (v0.5.0)

In v0.5.0 (issue #120), the codex / claude provider snapshot key names were unified and the claude wrapper pattern was removed.

| Area                | v0.4.x and below (Codex)             | v0.4.x and below (Claude)                   | v0.5.0+ (same on both providers)                                      |
| ------------------- | ------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------- |
| Usage array key     | `snapshots[]`                        | `networkUsages[]`                           | **`usageSnapshots[]`**                                                |
| Usage array element | Direct `UsageSnapshot`               | `{ accountKey, account, snapshot }` wrapper | **Direct `UsageSnapshot`** (wrapper removed)                          |
| Active flag         | `enabled: bool`                      | `detected` / `found` (2 keys)               | **`enabled: bool`** (single)                                          |
| Default account     | (none)                               | `selectedAccount`                           | (none, removed on both providers)                                     |
| credentialsPath     | Only at `cli-import` time (not null) | Always (never null)                         | **Only at `cli-import` time**, otherwise `null` (same policy on both) |

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

// after (v0.5.0+) — same path on codex / claude
const provider = (id) => data.providers.find((p) => p.id === id).snapshot;
const codexEnabled = provider('codex').enabled;
const codexSnaps = provider('codex').usageSnapshots;
const claudeEnabled = provider('claude').enabled;
//   found / detected: subtly different — "credential found anywhere" is the same as enabled.
//   To check pure credential-file existence, use credentialsPath != null instead.
const claudeWindows = provider('claude').usageSnapshots[0].usageWindows;
//   Wrapper removed — the `.snapshot` step no longer exists.
const claudeAccount = provider('claude').usageSnapshots.find(/* by criteria */)?.account;
//   Default-account concept removed — iterate usageSnapshots[] to identify if needed.
```

### `networkUsages[]` element structure (v0.4.x — removed in v0.5.0)

> **v0.5.0 (issue #120) update**: `networkUsages[]` itself was renamed to `usageSnapshots[]`, and the wrapper `{ accountKey, account, snapshot }` was unwrapped so that **UsageSnapshot is direct**. So in v0.5.0+ the wrapper step disappears: `.snapshot.usageWindows` → `.usageWindows`, one level shorter. See the Migration in §"Provider shape symmetry (v0.5.0)" above.

In the older `networkUsage` (v0.3.x, single object), the value was the usage snapshot object **directly**. But in v0.4.x's `networkUsages[]`, each element was a `{ accountKey, account, snapshot }` **wrapper**. The actual data (`usageWindows` / `status` etc.) was inside `.snapshot`.

```js
// before (v0.3.x — removed)
const ok = data.providers.find((p) => p.id === 'claude').snapshot.networkUsage.status.ok;
const windows = data.providers.find((p) => p.id === 'claude').snapshot.networkUsage.usageWindows;

// after (v0.4.0+)
const claude = data.providers.find((p) => p.id === 'claude').snapshot;
const ok = claude.networkUsages[0].snapshot.status.ok; // ← added .snapshot step
const windows = claude.networkUsages[0].snapshot.usageWindows;

// Multi-account iteration pattern
for (const entry of claude.networkUsages) {
  console.log(entry.accountKey, entry.snapshot.status.ok); // ← entry.snapshot
}
```

## Security principles

- Tokens are forbidden in stdout/stderr in any form (same for text mode).
- The `--json` mode is designed to be safe for sending through logging pipelines or external systems as-is, since it goes through redaction.
- When introducing free-form fields like `raw`, audit token-leakage risk case by case.
