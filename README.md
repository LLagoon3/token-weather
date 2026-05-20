# Token Weather

🌐 **English** · [한국어](./README.ko.md)

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/%40token-weather%2Fcli.svg)](https://www.npmjs.com/package/@token-weather/cli)
[![CI](https://github.com/LLagoon3/token-weather/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LLagoon3/token-weather/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/%40token-weather%2Fcli.svg)](https://nodejs.org/)

> Translated from [README.ko.md](./README.ko.md) — last sync 2026-05-20. The Korean version is the source of truth; this English version follows it. See [CONTRIBUTING.md §10](./CONTRIBUTING.md) for the i18n drift policy.

> **Local CLI dashboard for AI service usage and OAuth credentials.**
> A CLI that checks usage and auth status for multiple AI services (Codex / Claude) in one place, locally. **OAuth tokens never leave your machine** (even with the optional `@token-weather/telegram` activated, the bot token and OAuth tokens stay local — only usage metadata flows through Telegram servers; see [details](./docs/telegram-bot.en.md#security-model)).

## Install

```bash
# One-shot (no install)
npx @token-weather/cli status

# Global install
npm install -g @token-weather/cli
token-weather --help
```

First commands:

```bash
token-weather config init                              # creates ~/.config/token-weather/config.json
token-weather auth login claude                        # browser → localhost callback (PKCE + state) → real OAuth token saved
token-weather status                                   # auth / usage / expiry in one view
token-weather status --json | jq                       # normalized JSON for automation / dashboards
```

For environments where browser auto-callback is impractical (SSH, containers, port conflicts), use `--manual` — the OAuth URL is printed to the console; open it on another machine and paste back the callback URL:

```bash
token-weather auth login claude --manual
```

For test / experimental setups where you only need a mock account stored (no real token endpoint call), add `--mock` (default is real OAuth token exchange).

## Demo

<!-- TOKEN_WEATHER_DEMO_PLACEHOLDER: docs/assets/demo.svg will be added in a follow-up issue.
     Recording: bash scripts/record-demo.sh (requires asciinema + agg).
     The recording runs in an isolated HOME and the SVG output is grep-verified
     against token leakage before publish. -->

You can record the first-minute flow of `token-weather` locally with `bash scripts/record-demo.sh` ([asciinema](https://asciinema.org/) + [agg](https://github.com/asciinema/agg) required). The recording runs in an isolated HOME, and the resulting SVG is auto-checked against token patterns before publish.

## What & Why

- **What**: A CLI that unifies OAuth credentials and usage windows for AI tools, locally. Two providers in operation today — Codex (OpenAI) and Claude (Anthropic).
- **Why**: Other dashboards send tokens to external servers or depend on a separate auth service. Token Weather works with **its own broker + local credential store** — **OAuth tokens never leave your machine**. Even when `@token-weather/telegram` is enabled, tokens themselves stay local; only usage and account-label metadata flows through Telegram servers ([details](./docs/telegram-bot.en.md#security-model)).
- **How it's different**:
  - **Multi-account**: store multiple accounts per provider, query them in parallel, attach labels
  - **Automatic refresh**: expired access tokens are refreshed preflight before any provider call, with a single retry on auth failure
  - **`status --json` stable contract**: normalized output with token redaction guaranteed — directly consumable by external dashboards / collectors ([docs/cli-json-output.en.md](./docs/cli-json-output.en.md))
  - **Observed `client_id`**: uses the values observed from the provider binaries (not an officially registered OAuth client). Every publish of this tool itself is verified by npm Trusted Publishing OIDC + SLSA provenance, so the supply chain is independently auditable

## Supported providers

| Provider           | OAuth login           | Usage endpoint | Refresh | Status        |
| ------------------ | --------------------- | -------------- | ------- | ------------- |
| Codex (OpenAI)     | ✓ `auth login codex`  | `wham/usage`   | ✓       | In production |
| Claude (Anthropic) | ✓ `auth login claude` | `oauth/usage`  | ✓       | In production |

For provider-specific observed endpoint / client_id details, see [docs/provider-notes.en.md](./docs/provider-notes.en.md).

## Commands

Full reference via `token-weather <command> --help`. Summary:

```bash
token-weather status [--account <id>] [--provider <id>] [--json]   # usage + auth in one go
token-weather usage  [...]                                         # same output as status (alias)
token-weather doctor [codex|claude] [--refresh-live] [--account]   # environment / refresh diagnostics
token-weather auth login <codex|claude> [--mock] [--manual] [--label]
token-weather auth list   [provider]
token-weather auth logout <provider> [--account]
token-weather auth import claude                                   # absorb Claude CLI credentials
token-weather config init                                          # create config file
token-weather telegram setup    # Telegram bot pairing + OS service guidance (optional package)
token-weather telegram start    # Telegram bot daemon (foreground, Ctrl+C to exit)
token-weather telegram check    # Telegram config / token / linger diagnostics
```

By default, `auth login` performs a real OAuth token exchange. With `--mock`, only a mock account is stored (no token endpoint call — for tests / experiments). Use `--label` to attach a friendly name to a stored account, then refer to it later with `--account <label>`.

## Telegram bot (optional)

If you want to invoke `status` / `usage` / `doctor` / `auth list` remotely from your phone or another desktop, install the separate `@token-weather/telegram` package. During `telegram setup`, token-weather asks for consent before OS service registration — if accepted, it creates and enables a user-level systemd unit / launchd plist / Task Scheduler entry (#138, #141); if declined or unsupported (no systemctl / launchctl / schtasks, missing privileges), it prints manual registration instructions instead.

```bash
npm install -g @token-weather/telegram   # optional package
token-weather telegram setup             # bot token + pairing + OS service guidance
token-weather telegram start             # run the daemon (or use the systemd / launchd / Task Scheduler entry created at the end of setup)
```

Details / security model / manual OS service registration / FAQ: [docs/telegram-bot.en.md](./docs/telegram-bot.en.md).

## JSON output (automation)

`status` / `usage` emit a single normalized JSON line to stdout with `--json` — token redaction guaranteed. External dashboards / collectors can consume it directly.

```bash
token-weather status --json | jq '.providers[0]'
```

Shape / redaction rules / limits: [docs/cli-json-output.en.md](./docs/cli-json-output.en.md).

## Security principles

- localhost callback binds only to `127.0.0.1`, with PKCE S256 + state verification
- access / refresh / id tokens are redacted from both logs and JSON (via `SENSITIVE_KEYS`)
- raw prompts / responses / transcripts are never sent outside under any circumstance
- observed `client_id` has been used without a feature gate since v0.2.0 (every publish is still verified by npm Trusted Publishing OIDC + SLSA provenance). Until an official client is registered, this is experimentally operated

Details: [docs/auth-architecture.md](./docs/auth-architecture.md), [SECURITY.md](./SECURITY.md).

## Security reporting

This tool handles credentials like OAuth tokens, so please don't file security issues in public — use the private channel described in [SECURITY.md](./SECURITY.md). Conduct follows [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

[Apache License 2.0](./LICENSE). Submitting a PR means agreeing that your contribution is provided under the same license (see [CONTRIBUTING.md §9](./CONTRIBUTING.md) for details).

## Contributing

Contributions welcome. For PR / branch / commit rules see [CONTRIBUTING.md](./CONTRIBUTING.md); for code patterns / naming / tests / anti-patterns see [docs/codebase-guide.md](./docs/codebase-guide.md).

```bash
npm test              # full test suite (node:test built-in runner)
npm run test:agent    # agent package only
npm run test:adapters # provider adapters only
npm run test:schemas  # schemas only
```

In-progress work is tracked in [Issues](https://github.com/LLagoon3/token-weather/issues).

### Additional documentation

Quick entry point — [docs/INDEX.md](./docs/INDEX.md) (categorized).

**For end users** (referred to directly after npm install):

- [docs/architecture.md](./docs/architecture.md) — high-level structure summary
- [docs/auth-architecture.md](./docs/auth-architecture.md) — auth / token / source priority details
- [docs/auth-cli.md](./docs/auth-cli.md) — auth CLI commands / policy
- [docs/cli-json-output.en.md](./docs/cli-json-output.en.md) — `--json` stable contract + redaction rules
- [docs/provider-notes.en.md](./docs/provider-notes.en.md) — per-provider observed endpoint / client_id
- [docs/telegram-bot.en.md](./docs/telegram-bot.en.md) — Telegram bot optional package (`@token-weather/telegram`) guide
- [docs/typescript-consumers.md](./docs/typescript-consumers.md) — d.ts / import patterns for TypeScript users

**For contributors / maintainers** (contributors are Korean-based — kept in Korean only):

- [docs/codebase-guide.md](./docs/codebase-guide.md) — package layout / shared helpers / new-feature checklist
- [docs/release-policy.md](./docs/release-policy.md) — semver / changeset / bump criteria
- [docs/auth-store-schema.md](./docs/auth-store-schema.md) — auth.json storage schema (technical design)
- [docs/claude-oauth-plan.md](./docs/claude-oauth-plan.md) — Claude OAuth past implementation plan (archival)
