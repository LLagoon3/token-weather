# Provider notes

> Translated from [provider-notes.md](./provider-notes.md) — last sync 2026-05-20. The Korean version is the source of truth; this English version follows it. See [CONTRIBUTING.md §10](../CONTRIBUTING.md) for the i18n drift policy.

## OpenAI Codex

- Endpoint: `https://chatgpt.com/backend-api/wham/usage`
- Auth: OAuth bearer token (`Authorization: Bearer <accessToken>`)
- Optional header: `ChatGPT-Account-Id` (used to distinguish multiple accounts)
- Status: **Verified working in production** (live 200 OK confirmed)

### Auth flow

- Default: localhost callback OAuth (`http://localhost:<port>/auth/callback`)
  - PKCE S256 / state verification included
  - On port conflict, falls back automatically (up to 3 retries) → switches to manual paste
- Fallback: paste callback URL / code directly with the `--manual` flag
- Token exchange: default is a real endpoint POST (with `--mock`, only a mock account is stored)
- Auth store priority: `agent-store > openclaw-import`

### OAuth endpoints

- authorize: `https://auth.openai.com/oauth/authorize`
- token: `https://auth.openai.com/oauth/token`
- callback: `http://localhost:1455/auth/callback`
- client_id: `app_EMoamEEZ73f0CkXaXp7hrann` (observed, not officially confirmed)
- Extra authorize params: `id_token_add_organizations=true`, `codex_cli_simplified_flow=true`, `originator=pi`

### Known limits

- `auth logout` only removes the local store (does not call the provider's revoke endpoint)
- Network calls don't use timeout / AbortController → issue #7
- Whether `client_secret` is required is not confirmed

---

## Anthropic / Claude

### Auth flow

Two paths coexist.

- `auth login claude`: independent OAuth (browser login) → live token saved to agent-store (default)
- `auth import claude`: reads `~/.claude/.credentials.json` → copies into agent-store

Credential source priority: `agent-store > claude-cli-import`

### Live usage endpoint

- `GET https://api.anthropic.com/api/oauth/usage`
- Headers: `Authorization: Bearer <token>`, `anthropic-version: 2023-06-01`, `anthropic-beta: oauth-2025-04-20`
- Status: **Verified working in production** (live 200 OK, returns utilization numbers)
- Response shape (observed):
  - `five_hour: { utilization, resets_at }` — 5-hour window
  - `seven_day: { utilization, resets_at }` — weekly window
  - `seven_day_sonnet / seven_day_opus: { utilization }` — per-model weekly

### OAuth endpoints (observed — extracted from the Claude Code v2.1.107 binary)

- authorize: `https://claude.com/cai/oauth/authorize` (claude.ai user OAuth)
- token: `https://platform.claude.com/v1/oauth/token`
- redirect_uri: `http://localhost:<port>/callback` (path differs from Codex)
- manual redirect: `https://platform.claude.com/oauth/code/callback`
- success page: `https://platform.claude.com/oauth/code/success?app=claude-code`
- client_id: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- scopes: `org:create_api_key user:profile user:inference`

### Observation-based caveats (Claude-specific)

- The authorize URL also sends a `code=true` parameter (an extension outside the OAuth spec)
- The token endpoint requires a **JSON body**. form-urlencoded gets a Claude API error (`invalid_request_error`)
- The `authorization_code` grant requires a `state` field in the body
- `https://platform.claude.com/oauth/authorize` is a separate flow for API-key issuance → do not confuse with the claude.ai path

### Credential file (claude-cli-import)

- Path: `~/.claude/.credentials.json`
- Shape: `{ claudeAiOauth: { accessToken, refreshToken, expiresAt, scopes, subscriptionType, rateLimitTier } }`

### Refresh token

- `refreshClaudeToken` implemented (same shape as Codex `refreshCodexToken`; no feature gate since #97)
- Manually verifiable via `doctor claude --refresh-live`
- Rotation handling: replace `refresh_token` with the one in the response if present; keep the existing one otherwise

### Local usage (stats-cache) — removed in v0.3.0

The dependency on `~/.claude/stats-cache.json` (Claude Code's client-side telemetry artifact) was removed in v0.3.0 (issue #110). Users who need cumulative stats (totalSessions, totalMessages, per-model) can parse that file directly — it's Anthropic's internal artifact, so this tool does not abstract over it.

This tool now exposes only the window-based utilization information (five_hour / seven_day) from the network endpoint (`/api/oauth/usage`) — architectural symmetry with Codex's server-side rate-limit model.

### Known limits / unconfirmed

- Whether `client_secret` is required (currently assumed to be a public client)
- Detailed refresh-token rotation policy
- Network calls don't use timeout / AbortController (issue #7)
- Web session cookie fallback is not implemented (issue #14)
