# Architecture

> Translated from [architecture.md](./architecture.md) — last sync 2026-05-20. The Korean version is the source of truth; this English version follows it. See [CONTRIBUTING.md §10](../CONTRIBUTING.md) for the i18n drift policy.

Detailed codebase rules live in `docs/codebase-guide.md`. This document covers only the high-level composition.

## Summary

A local CLI agent-centric architecture. Without any external auth store (OpenClaw, etc.) dependency, it independently handles authentication, token storage / refresh, and usage queries.

```
[token-weather CLI]
  ├─ Auth Commands (login / list / logout / import)
  ├─ Auth Broker (OAuth localhost callback, manual paste fallback, PKCE S256)
  ├─ Credential Store (auth.json, 0600)
  ├─ Provider Registry (services/provider-registry.js)
  │   ├─ Codex provider
  │   └─ Claude provider
  ├─ Provider Adapters (packages/provider-adapters/src/{codex,claude})
  │   └─ Shared OAuth helpers (packages/provider-adapters/src/shared/)
  └─ Schemas (packages/schemas — usage snapshot / event JSON Schema)
```

## Main components

### CLI Agent (`packages/agent`)

- `status`, `usage`, `doctor`, `config init`
- `auth login/list/logout/import`
- Multi-account support
  - Store / query multiple real accounts per provider (status queries all in parallel by default)
  - `auth login --label <name>` attaches a user-friendly label
  - `status --account <email|accountKey|label>` filters
  - `config.json defaults.profiles.{provider}` sets a default filter
- `login-runner` (`cli/login-runner.js`) unifies the per-provider OAuth flow

### Services (`packages/agent/src/services`)

- `status-service.js` — loads config + iterates the provider registry
- `provider-registry.js` — registers providers via the `PROVIDER_REGISTRY` array
- `{provider}-provider.js` — snapshot builder for each provider

When adding a new provider, refer to the `codebase-guide.md §11` checklist.

### Provider Adapters (`packages/provider-adapters`)

- `shared/` — provider-neutral OAuth helpers
  - `buildOAuthAuthorizationUrl` — composes the authorize URL
  - `postToTokenEndpoint` — POST to the token endpoint (form/json, timeout, error normalization)
  - `fetchWithTimeout` — shared wrapper based on AbortController
- `codex/` — Codex (OpenAI) auth + usage
- `claude/` — Claude (Anthropic) auth + usage

Each provider follows the same file-composition pattern (constants / build-authorization-url / exchange-code / refresh-token / fetch-usage). For details see `docs/codebase-guide.md §3`.

### Schemas (`packages/schemas`)

- `usage-snapshot.schema.json`
- `usage-event.schema.json`
- Key fields: `source`, `authType`, `confidence`, `usageWindows`, `status.bucket`
- `validateUsageSnapshot` / `validateUsageEvent` — zero-dep runtime validators
- Auto-validation at the `buildUsageSnapshot` exit (soft enforcement — on invalid, warns + lowers confidence)

### Auth layer

- Default: localhost callback OAuth (PKCE S256)
- Fallback: manual paste (Codex only)
- Import: `auth import openclaw` (Codex) / `auth import claude` (Claude)
- Lower priority: device code (not implemented)
- Credential source priority: `agent-store` > `{provider}-cli-import` or `openclaw-import`

Details: `docs/auth-architecture.en.md`, `docs/auth-cli.en.md`.

## Future directions

- Backend API: normalized event collection, direct provider polling, aggregated state
- Web dashboard: overview, provider/account detail, timeline
- Keychain integration
- Additional providers (e.g., Gemini, Perplexity) — follow `codebase-guide.md §11`
