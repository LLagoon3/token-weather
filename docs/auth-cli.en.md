# Auth CLI interface

> Translated from [auth-cli.md](./auth-cli.md) — last sync 2026-05-20. The Korean version is the source of truth; this English version follows it. See [CONTRIBUTING.md §10](../CONTRIBUTING.md) for the i18n drift policy.

This document summarizes `token-weather`'s auth-related CLI commands and operational policy.

## Command structure

```text
token-weather auth <subcommand> [provider] [options]
token-weather doctor [provider] [options]
```

## login

```bash
token-weather auth login codex   [--manual] [--no-open] [--port N] [--timeout SEC] [--mock]
token-weather auth login claude  [--manual] [--no-open] [--port N] [--timeout SEC] [--mock]
```

Behavior:

- Based on localhost callback OAuth (PKCE S256 + state)
- **Default path is a real OAuth token exchange** — POST to the provider token endpoint and store access/refresh tokens
- With `--mock`, only a mock account is stored (no token endpoint call — for tests / experiments)
- On success, tokens are stored in the agent-store (`auth.json`)

Options:

- `--mock`: store only a mock account without calling the token endpoint (testing / experiments)
- `--manual`: manually paste callback URL / code (SSH / containers / port-conflict environments)
- `--no-open`: don't auto-launch the browser
- `--port N`: specify the localhost callback port (integer 0–65535). Out-of-range values print a warning and abort login.
- `--timeout SEC`: callback wait time (default 120s). Must be a positive integer; otherwise warn and abort.
- `--label <name>`: attach a label to the stored account. Later referenced via `--account <name>`.
- `--keep-legacy`: keep, rather than auto-remove, legacy `accountKey` entries with the same sub/email as the new token. Default is auto-cleanup.

Per-provider callback paths:

- Codex: `/auth/callback`
- Claude: `/callback`

## list

```bash
token-weather auth list
token-weather auth list openai-codex
token-weather auth list claude
```

Output fields: provider, accountKey, email, label, source, authType, status, mock flag, refresh availability, expiresAt, createdAt, updatedAt.

For Claude, both agent-store accounts and the `~/.claude/.credentials.json` import source are displayed.

## logout

```bash
token-weather auth logout <provider>
token-weather auth logout <provider> --account <email | accountKey | label>
```

- Removes the account from the local auth store
- `--account` accepts email / accountKey / label (case-insensitive)
- Provider-side revoke endpoint call is not implemented (follow-up)

## import

```bash
token-weather auth import claude     # ~/.claude/.credentials.json → agent-store
```

- Currently the only supported import provider is `claude`. Other inputs exit with the message `import is currently only supported for claude`.
- For **migration / absorption**, not the default runtime path
- Claude import is a fast path that copies the CLI credential as-is (no network call)
- OpenClaw auth-profiles data is not absorbed by the `auth import` command, but when there is no Codex account in `agent-store`, the status snapshot automatically falls back to the `openclaw-import` source as read-only (see "Credential source priority" in `docs/auth-architecture.md`).

## doctor

```bash
token-weather doctor                        # Common state check
token-weather doctor codex                  # Codex account / refresh viability check
token-weather doctor codex  --refresh-live  # Real refresh POST
token-weather doctor codex  --account <id>  # Target a specific account
token-weather doctor claude                 # Claude credential + live usage check
token-weather doctor claude --refresh-live  # Claude refresh POST
token-weather doctor claude --refresh-live --account <id>  # Target a specific account
```

Check items:

- Existence of auth store / credential files
- The account that would be selected (agent-store > import priority)
- Whether `expiresAt` is imminent
- Refresh viability (`refreshToken` present + not mock)
- Summary of the live usage endpoint response
- With `--refresh-live`, run a real refresh call and show the result

`doctor --refresh-live` is a manual diagnostic / verification path. It operates separately from the auto-refresh in `status` / `usage`.

### `--dedupe` (issue #37)

Cleans up stale records sharing the same OAuth subject (sub or email). Retroactively cleans up legacy `accountKey`s accumulated before the auto-cleanup at login time (PR #38) and cases where `id_token` parsing failed partially.

```bash
token-weather doctor codex  --dedupe                              # dry-run: print candidates only
token-weather doctor codex  --dedupe --apply                      # actually remove
token-weather doctor codex  --dedupe --backfill-account-id        # dry-run including backfill candidates
token-weather doctor codex  --dedupe --backfill-account-id --apply  # actually apply
token-weather doctor claude --dedupe ...                          # same options
```

Behavior:

- `--dedupe` alone: print duplicate groups + keep/remove candidates to the console only (no changes to auth.json)
- `--dedupe --apply`: keep one primary per group and remove the rest via `removeProviderAccount`
- `--backfill-account-id`: also handle records with an empty `accountId` that could be filled from `raw.idToken`'s `sub`

Primary selection priority (lower is kept):

1. The side with `accountId` set
2. `status === 'active'` (vs `disabled`)
3. `source === 'agent-store'` (vs `claude-cli-import` / `manual` etc.)
4. Most recent `updatedAt`
5. Lexicographic `accountKey` (stable sort)

Filters:

- Records with `source === 'manual'` or `raw.mock === true` are excluded from grouping
- Synthetic emails (`live-*@codex.openai.com`) are excluded from email-based matching

Interaction:

- If `--account` and `--dedupe` are passed together, `--account` is ignored and all accounts are inspected (with a warning)
- If `--dedupe` and `--refresh-live` come together, `--dedupe` takes precedence and only dedupe runs

Safety guidance:

- Always dry-run first (`--dedupe` alone) to review candidates, then `--apply`
- Once removed, a record is not auto-recoverable — back up `~/.config/token-weather/auth.json` beforehand if needed
- v1 runs `doctor codex` / `doctor claude` separately — cross-provider unified dedupe is not supported

## Port-conflict policy (Codex)

- Default port: `1455`
- On conflict, try `1456`, `1457` in order, up to 3 attempts
- If all 3 fail → auto-switch to manual paste mode
- When `--port` is explicit, only that port is tried; error on failure

Claude uses the same `resolveCallbackPort` logic, but the callback path differs.

## Auto-refresh policy for status / usage

- Targets are **agent-store real accounts only**.
- For access tokens whose `expiresAt` has already passed, try a preflight refresh before calling the provider.
- If the first provider response normalizes to an auth failure (`status.bucket === 'auth'`), refresh and retry exactly once.
- A refresh failure is recorded as a usage failure for that account; other accounts' queries continue.
- Import sources (`openclaw-import`, `claude-cli-import`) are excluded from auto-refresh because they have no store update path.
- Source precedence is decided first on the unfiltered baseline; the actual target re-applies `--account` / config filters on top of the chosen source.

## Multi-account policy

- 1 account: auto-select
- Multiple accounts: pick the active account with the most recent `lastUsedAt`
- `--account` lets you override explicitly (email or accountKey)

## UX principles

- Keep default commands as short as possible
- Open up detailed control via options
- On failure, guide the next action rather than printing a plain error
- Provide a clear fallback path for headless / remote environments
- Multi-account works via auto + explicit override

## Example scenarios

### Desktop: Claude independent OAuth

```bash
token-weather auth login claude
# authorize URL printed → open in the browser
# Login complete → localhost callback received → token saved
token-weather status
```

### Desktop: Claude fast import

```bash
# When already logged in via the Claude CLI
token-weather auth import claude
token-weather status
```

### SSH / remote: Codex manual

```bash
token-weather auth login codex --manual --no-open
# Follow the prompt: open the URL manually in the browser → paste the entire returned URL
```

## Open questions

- Whether `client_secret` is required (both Codex / Claude)
- Scope of revoke-endpoint support (server-side invalidation on logout)
- Whether to introduce the device code flow
- Keychain integration
- Whether to restore the `auth import openclaw` command — currently not implemented (only claude is supported). The status snapshot reads OpenClaw data as a fallback source, but the imperative import path is a follow-up decision.
