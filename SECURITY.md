# Security policy

🌐 **English** · [한국어](./SECURITY.ko.md)

> Translated from [SECURITY.ko.md](./SECURITY.ko.md) — last sync 2026-05-21. The Korean version is the source of truth; this English version follows it. See [CONTRIBUTING.md §10](./CONTRIBUTING.md) for the i18n drift policy.

This tool handles credentials such as OAuth access / refresh / id tokens locally. Please report security issues via a private channel, not the public issue tracker.

## Supported versions

| Version | Supported |
| ------- | --------- |
| `0.1.x` | ✅        |
| Older   | ❌        |

## Private reporting channel

Please report privately through GitHub Security Advisory.

- Report page: https://github.com/LLagoon3/token-weather/security/advisories/new
- Average response SLA: a first reply within 5 business days
- High-severity (remote token leakage, credential exposure, etc.) gets priority handling

## When a token has accidentally been posted in a public place

If an access token, refresh token, id token, session cookie, or account key has been pasted as-is into a GitHub Issue / PR / external channel (Slack, email body, etc.):

1. Immediately remove the token from that location (or make the issue/PR private).
2. **Revoke** the credential right away.
   - Codex (OpenAI): https://platform.openai.com/account/api-keys or log out of chatgpt.com sessions
   - Claude (Anthropic): https://console.anthropic.com or re-login via the Claude CLI
3. Run `token-weather auth logout <provider>` to remove it from the local store as well, then re-login.

Token recovery / automatic revoke is not provided (provider revoke endpoints are not integrated yet).

## When adding a new token-bearing field (maintainers / contributors)

The `status --json` output applies redaction based on a token-key blacklist (see `docs/cli-json-output.en.md` §Limits). When adding a new token field to a provider adapter / auth schema, the PR should also:

- Register the new key in `packages/agent/src/cli/status-json.js::SENSITIVE_KEYS`
- Add a `--json` output regression test (inject a fake token → verify no leakage in the JSON)

Skipping this can expose tokens to external consumers as-is.

## Telegram bot integration threat model (when using `@token-weather/telegram`)

Activating the optional `@token-weather/telegram` package expands token-weather's trust boundary. Please review the following before activation. The full security model is in [docs/telegram-bot.en.md §Security model](./docs/telegram-bot.en.md#security-model).

### Trust boundaries

- **Local only** (split by storage location):
  - OAuth access / refresh / id tokens: stored in `~/.config/token-weather/auth.json`. The auth store writes with mode 0600.
  - Telegram bot token / allowedUserIds: stored under `channels.telegram` in `~/.config/token-weather/config.json`. `telegram setup` applies chmod 600 on a best-effort basis.
  - Pairing code: exists only in the terminal and the one-shot pairing daemon's memory during setup. Not persisted to config / auth store.

  All three paths are protected by `SENSITIVE_KEYS` redaction — they don't appear in any output.

- **Flows through Telegram servers (newly added)**: usage numbers / account labels / email / command response bodies / user_id. When the bot is active, the README's "local only" promise is **narrowed to OAuth tokens + bot tokens**.

### First-line defenses at the bot token / channel level

- `channels.telegram.allowedUserIds` allowlist — messages from unregistered user_ids are silently ignored (responses / logs are masked). Even if the bot token leaks, the command surface does not immediately open up.
- Single-instance lock — if another daemon is already polling with the same bot token, a 409 Conflict is detected and the new instance exits. Avoids accidentally running a second daemon.
- Reduced command surface exposure — `/doctor` exposes only the root call, `/auth_list` blocks arguments. Side-effecting calls (e.g., token refresh-live) cannot be triggered remotely.

### When a bot token is leaked

1. In BotFather (`@BotFather`), run `/revoke` to invalidate the token immediately (or `/token` to issue a new one).
2. Update the local `config.channels.telegram.botToken` — rerunning `token-weather telegram setup` is the safest path.
3. Verify the `getMe API` responds `✓` with the new token via `token-weather telegram check`.
4. Confirm `~/.config/token-weather/config.json` is `chmod 600` — see the "config permission" item in `telegram check`.

### Additional reportable scenarios

- You find a user_id you don't recognize in `allowedUserIds` → immediately remove it from the array and restart the daemon (`systemctl --user restart token-weather-bot.service` or stop → start).
- The bot doesn't respond to your commands but responds to someone else → suspect bot-token or allowlist tampering. Revoke the BotFather token and report.
- The daemon log repeatedly shows a masked id (`xxx****yy`) that is not yours under "rejected unregistered user_id" → indicates the bot token may be known externally. Revoking the token is recommended.
