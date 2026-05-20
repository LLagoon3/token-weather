# Auth architecture

> Translated from [auth-architecture.md](./auth-architecture.md) — last sync 2026-05-20. The Korean version is the source of truth; this English version follows it. See [CONTRIBUTING.md §10](../CONTRIBUTING.md) for the i18n drift policy.

## Goals

The CLI agent independently handles authentication, token storage, refresh, and usage without depending on any external auth store (OpenClaw, etc.).

## Current composition

```text
[token-weather CLI]
  ├─ Auth Commands (login / list / logout / import)
  ├─ Auth Broker
  │   ├─ OAuth localhost callback flow (shared by Codex / Claude)
  │   ├─ Manual paste fallback (Codex)
  │   └─ Device code fallback (not implemented, lower priority)
  ├─ Credential Store (~/.config/token-weather/auth.json, 0600)
  ├─ Provider Adapters (codex / claude)
  └─ Usage / Event Pipeline
```

The default runtime path is the agent's own store; the OpenClaw dependency has been removed. Legacy auth-profiles can only be migrated via `auth import openclaw`.

## Auth flow

### 1. Localhost callback OAuth (default)

1. `token-weather auth login <codex|claude>`
2. Start a temporary local server (`127.0.0.1:<port>`)
3. Generate PKCE (S256) / state
4. Print an authorize URL for the browser (does not auto-open)
5. User completes login → provider sends `code` back via the localhost callback
6. POST `authorization_code` grant to the token endpoint (default behavior — with `--mock`, only a mock account is stored)
7. Save access/refresh tokens in the agent-store

Per-provider callback paths:

- Codex: `http://localhost:<port>/auth/callback`
- Claude: `http://localhost:<port>/callback`

### 2. Manual paste (Codex-only fallback)

- Paste the whole callback URL
- Use `--no-open` to prevent browser auto-open
- For remote / SSH environments with limited localhost access

### 3. Claude CLI credential import (Claude only)

`token-weather auth import claude` copies the OAuth tokens from `~/.claude/.credentials.json` into the agent-store. A fast path usable without any network call.

### 4. Device code flow (not implemented, lower priority)

## Credential source priority

### Codex

1. `agent-store` (a real token stored via auth login)
2. `openclaw-import` (legacy OpenClaw auth-profiles.json)

### Claude

1. `agent-store` (entries stored via `auth login claude` or `auth import claude`)
2. `claude-cli-import` (real-time reader of `~/.claude/.credentials.json`)

## Storage design principles

- `~/.config/token-weather/auth.json`, permissions `0600`
- Designed so that normalized auth metadata and sensitive tokens are logically separable
- Can later be extended to a keychain
- Refresh tokens / session cookies must not be uploaded to external servers

## Security principles

- The callback server binds only to `127.0.0.1`
- State verification is mandatory (CSRF)
- PKCE S256
- Refresh tokens are stored at the minimum required scope
- Access / refresh tokens must never be printed to logs
- Don't store sensitive auth values from raw provider responses

## Auto-refresh flow for usage/status

`status` / `usage` are more than simple queries — accounts in the agent-store go through a shared auto-refresh orchestration.

1. Collect candidate accounts / sources per provider.
2. Auth source priority is decided on the unfiltered baseline.
3. Re-apply `--account` / config filters on top of the chosen source for the actual target.
4. If an agent-store account's `expiresAt` has already expired, try a preflight refresh before calling the provider.
5. If the first usage call fails for auth reasons (`status.bucket === 'auth'`), refresh and retry exactly once.
6. A refresh failure is recorded per-account; other accounts' queries continue.
7. Import sources (`openclaw-import`, `claude-cli-import`) are excluded from auto-refresh because they have no store update path.

## Role of the provider adapter

The auth broker is shared; per-provider strategy is defined by the adapter:

- authorize / token endpoint
- observed client_id
- scopes / extra params
- redirect_uri format (callback path)
- refresh rotation policy
- account identification rule

## CLI

```text
token-weather auth login <codex|claude> [--mock] [--port N] [--timeout SEC] [--manual] [--no-open]
token-weather auth list
token-weather auth logout <provider> [--account <id>]
token-weather auth import <openclaw|claude>
token-weather doctor
token-weather doctor codex [--refresh-live] [--account <id>]
token-weather doctor claude [--refresh-live]
token-weather status | usage
```

## Verification status — Codex OAuth endpoints

### Verified

- authorize: `https://auth.openai.com/oauth/authorize`
- token: `https://auth.openai.com/oauth/token`
- callback: `http://localhost:1455/auth/callback`
- JWT issuer: `https://auth.openai.com`
- PKCE S256, state verification, refresh rotation: confirmed with a real token

### Observed (not officially confirmed)

- client_id: `app_EMoamEEZ73f0CkXaXp7hrann` (observed in a local JWT payload)
- extra authorize params: `id_token_add_organizations=true`, `codex_cli_simplified_flow=true`, `originator=pi`

### Unconfirmed

- Whether `client_secret` is required (currently assumed public client)
- General rule for the refresh-token rotation policy
- Network-call timeout / abort handling (issue #7)

## Verification status — Claude OAuth endpoints

### Verified (with real network calls)

- usage: `GET https://api.anthropic.com/api/oauth/usage` (Bearer + anthropic-version + anthropic-beta) → 200 OK
- refresh: `POST https://platform.claude.com/v1/oauth/token` (`grant_type=refresh_token`, JSON body) → confirmed standard OAuth error response structure
- Full independent OAuth flow: browser login → callback → `authorization_code` token exchange → agent-store save → usage endpoint 200 OK — confirmed end-to-end

### Observed (extracted from strings in the Claude Code v2.1.107 binary)

- authorize: `https://claude.com/cai/oauth/authorize` (claude.ai user OAuth path)
- token: `https://platform.claude.com/v1/oauth/token`
- manual redirect: `https://platform.claude.com/oauth/code/callback`
- client_id: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- scopes: `org:create_api_key user:profile user:inference`

### Claude observation-based notices

- The authorize URL requires an additional `code=true` parameter (an extension outside the OAuth spec)
- The token endpoint requires a JSON body (form-urlencoded gets a Claude API error)
- The `authorization_code` grant requires a `state` field in the body
- The redirect_uri path is `/callback` (different from Codex's `/auth/callback`)

### Unconfirmed

- Whether `client_secret` is required (assumed public client)
- Refresh-token rotation policy
- Whether other client_id values exist (`22422756-...` appears to be local-oauth only)

## Auth default

For both Codex and Claude, `auth login` defaults to a real OAuth token exchange (POST token endpoint → save access/refresh token). Use `--mock` opt-in to only save a mock account. The `exchange*` / `refresh*` functions in the provider-adapters library can also be called directly without a feature gate — the `allowLiveExchange` parameter was removed in #97.

## Operations

- Token storage: `auth.json` + `0600` (default path `~/.config/token-weather/`)
- Multi-account: auto-select by `lastUsedAt` + override with `--account`
- On callback port conflict: try up to 3 alternative ports starting from the default → switch to manual paste on failure (Codex)
- Timeout: `--timeout <seconds>` (default 120s)
- Device code is a lower-priority investigation item

## Next-step candidates

- Network-call timeout / abort (Codex/Claude shared, issue #7)
- Investigate revoke endpoint support (server-side invalidation on logout)
- Claude Phase 4 — session cookie fallback (optional, issue #14)
- Keychain integration
- Device code flow
