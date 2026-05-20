# Telegram bot integration

> Translated from [telegram-bot.md](./telegram-bot.md) — last sync 2026-05-20. The Korean version is the source of truth; this English version follows it. See [CONTRIBUTING.md §10](../CONTRIBUTING.md) for the i18n drift policy.

The `@token-weather/telegram` package provides a long-poll daemon that exposes token-weather's `status` / `usage` / `doctor` / `auth list` commands over Telegram. Run the bot locally, and you can send commands from your phone or another desktop and get immediate responses.

> **Trust model summary**: bot token / OAuth tokens are **stored only in local files**. Usage numbers / account labels / command response bodies do flow through Telegram servers. For the full security model see [§Security model](#보안-모델).

## Quick start

```bash
# 1) Install both packages — cli + telegram
npm install -g @token-weather/cli @token-weather/telegram

# 2) Create a bot in BotFather → get a token
#    https://core.telegram.org/bots#how-do-i-create-a-bot
#    /newbot → choose name + username → copy the token

# 3) Bot token + chat pairing + config save + OS service auto-registration / guidance, all in one command
token-weather telegram setup
#    token prompt → getMe validation → click the deep link in the output → (Start button) → pairing complete
#    → "Auto-install? [Y/n]" → Enter → systemd / launchd / Task Scheduler auto-registered

# 4) (Optional) diagnostics
token-weather telegram check

# 5) Manual run (when not using an OS service)
token-weather telegram start

# 6) Remove (undo auto-registration)
token-weather telegram uninstall-service
```

## Commands

| Command                                              | Description                                                                                                                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token-weather telegram setup`                       | Enter bot token → `getMe` validation → **click deep link** or type `/pair <code>` manually → save config (chmod 600) → **OS service auto-register [Y/n]** (falls back to manual instructions on decline) |
| `token-weather telegram start`                       | Run long-poll daemon in the foreground. Ctrl+C to exit                                                                                                                                       |
| `token-weather telegram check`                       | Read-only diagnostics of config / token / chmod / linger state                                                                                                                               |
| `token-weather telegram uninstall-service`           | Remove the OS service registered via `setup` (config / auth.json untouched)                                                                                                                  |
| `... telegram --help`<br>`... telegram <sub> --help` | Help text for each command                                                                                                                                                                   |

## Chat commands the bot receives

| Telegram command | Behavior (equivalent to `token-weather <cmd>`)                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `/status`        | Mobile-width-friendly compact plain text (HTML `<pre>` block, ≤ 32 columns, includes progress bar)                                        |
| `/status --json` | `formatStatusJson` result (top-level `command` = "status")                                                                                |
| `/usage`         | Alias of status — mobile-friendly compact plain text                                                                                      |
| `/usage --json`  | `formatStatusJson` result (top-level `command` = "usage")                                                                                 |
| `/doctor`        | Default `runDoctorRoot` output. Arguments / subcommands blocked                                                                           |
| `/auth_list`     | All providers' stored accounts + claude import section                                                                                    |
| `/help`          | Plain-text list of available commands (issue #148)                                                                                        |
| `/start <code>`  | Pairing only (meaningful only during setup). Click the Telegram deep link → bot chat → (Start button if first time) → `/start <code>` is sent |
| `/pair <code>`   | Pairing only (meaningful only during setup). Manual input fallback                                                                        |

Commands that mention another bot (`/status@OtherBot`) are silently ignored — so in group chats, token-weather won't respond to other bots' commands.

### Autocompletion menu (issue #148)

When `token-weather telegram start` daemon boots, it calls the [Bot API `setMyCommands`](https://core.telegram.org/bots/api#setmycommands) to register the command list with the bot. The user can then type `/` in the chat input, and Telegram clients (mobile / desktop) will pop up an autocompletion menu.

- Registration source: the `BOT_COMMANDS` array in `packages/telegram/src/bot-commands.js`. When adding a new command, update **three places together**: the handler module / the `buildDispatcher()` key / this array — the dispatcher is **not** auto-generated from this array. A unit test guards the drift between the dispatcher key set and `BOT_COMMANDS.command`.
- If registration fails (network / permission / etc.) the daemon boot continues — the menu is auxiliary, and direct command input keeps working.
- Registration is idempotent — refreshed on every daemon restart.

Manual registration (if you want to disable auto-registration or preconfigure with a different bot username) is also possible via `/setcommands` in [@BotFather](https://t.me/BotFather).

### `/status` / `/usage` output example (issues #144, #146)

The CLI's desktop boxes (`╭─` / `│` / `╰─`) + 50-column heavy rule break under wrap at mobile widths (~30–40 columns), so the Telegram bot uses `@token-weather/telegram`'s `formatStatusForTelegram` to emit a box-less compact output (line width ≤ 32 columns guideline, timezone omitted).

Issue #146 restored 10-column ASCII progress bars (1/8-precision fractional blocks `█▏▎▍▌▋▊▉` + light shade `░`) on the window lines — ANSI colors are not applied because Telegram's `<pre>` does not support them.

```
━━ Status ━━
Codex  enabled
Claude enabled
Sync   disabled

━━ Codex ━━
me@example.com · Pro
✓ OK (200)
· primary   ███▊░░░░░░  38%
  reset 9:42pm
· secondary ███████▏░░  71%
  reset Sat 4:42am

━━ Claude ━━
me@anthropic.example
✓ OK (200)
· 5h        █▉░░░░░░░░  19%
  reset 3pm
· 7d        ▊░░░░░░░░░   8%
  reset May 22 3am
```

Line width: `· ` (2) + label `padEnd(9)` + space + bar (10) + space + pct `padStart(4)` = **27 characters**, well within the 32-column guide. If `usedPercent` is null/NaN, the bar is 10× `░` and pct is `—`.

CLI plain output (`token-weather status` on desktop) and the `--json` contract are unchanged — this is a Telegram-channel-only transformation.

## OS service registration

The last step of `telegram setup` shows a **`Auto-install? [Y/n]`** prompt:

- **Enter / y** (default): token-weather directly writes and activates a systemd unit / launchd plist / Task Scheduler entry (`systemctl --user enable --now` / `launchctl bootstrap` / `schtasks /Create`). On Linux it also runs `loginctl enable-linger` (best-effort).
- **n**: skip auto-registration → user copies/pastes the manual instructions block below.
- **systemd / launchctl / schtasks not detected** (WSL / Docker container / Alpine OpenRC etc.): auto-skip + same manual instructions printed.
- **Path contains whitespace / special characters** (e.g., Windows' `C:\Program Files\nodejs\node.exe`): auto-registration is supported (issue #141). systemd uses `ExecStart="..."` double-quote, launchd plist uses XML entity escape (`& < >` → `&amp; &lt; &gt;`), Windows schtasks uses cmd `\"...\"` — each properly quoted. Windows standard Node install environments can be auto-registered as-is.

To remove later, run `token-weather telegram uninstall-service`. Its scope covers service / linger only (config / auth.json are kept).

### Manual registration (when auto-registration is declined / skipped)

> ⚠ The code blocks below are **structural examples**. Placeholders like `/path/to/node` / `/path/to/token-weather` differ in your environment — **copy the absolute paths from the `telegram setup` output as-is**. Even with whitespace / XML special characters in the path, the setup output already applies OS-specific escapes (`"..."` / `&amp;` / `\"...\"`), so just copy and paste (issue #141).

### Linux (systemd `--user`, no sudo)

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/token-weather-bot.service <<'EOF'
[Unit]
Description=Token Weather Telegram bot
After=network-online.target

[Service]
ExecStart=/path/to/node /path/to/token-weather telegram start
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now token-weather-bot.service
# To keep the daemon alive across logouts:
loginctl enable-linger "$USER"
```

### macOS (launchd LaunchAgent, no sudo)

After writing `~/Library/LaunchAgents/com.token-weather.bot.plist`:

```bash
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.token-weather.bot.plist
# Stop:
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/com.token-weather.bot.plist
```

The full plist content is whatever `telegram setup` outputs.

### Windows (Task Scheduler, no admin)

```cmd
schtasks /Create /TN "TokenWeatherBot" /SC ONLOGON /RL LIMITED /TR "\"path\to\node.exe\" \"path\to\token-weather\" telegram start"
:: Remove:
schtasks /Delete /TN "TokenWeatherBot" /F
```

## Security model

### Trust boundaries

- **Stays local** (three separate paths):
  - **OAuth access / refresh / id tokens** — stored in `~/.config/token-weather/auth.json`. The auth store writes with mode 0600.
  - **Telegram bot token / allowedUserIds** — under `channels.telegram` in `~/.config/token-weather/config.json`. `telegram setup` applies chmod 600 on a best-effort basis (on OSes where chmod has weak semantics, like Windows, verify via the "config permission" item in `telegram check`).
  - **Pairing code** — exists only in the terminal and the one-shot pairing daemon's memory during `telegram setup`. Not persisted in config / auth store.

  All three paths are protected by `SENSITIVE_KEYS` redaction — they don't show up in any output (`status --json` / Telegram responses / logs).

- **Goes through Telegram servers**: usage numbers / account labels / email / token expiry / command response bodies / user_id. The README's promise "tokens never leave the external server" is **scoped to OAuth tokens + Telegram bot tokens** — when the bot is active, metadata flows through Telegram infrastructure.

### First-line defenses

- `allowedUserIds` allowlist — even if the bot token is leaked, commands from unregistered users are silently ignored. The bot doesn't even confirm its own existence / activity in response (only a partially masked user_id remains in the logs).
- Single-instance lock — if another daemon is polling with the same bot token, a 409 Conflict is detected, a friendly notice is printed, and the new instance exits immediately.

### When the bot token is leaked

1. Use `/revoke` in BotFather to invalidate the token immediately (or `/token` to issue a new one).
2. Update `channels.telegram.botToken` in `~/.config/token-weather/config.json` (or rerun `telegram setup`).
3. Verify the new token's `getMe` response with `telegram check`.

If the leaked element is a user_id in `allowedUserIds` (shared family / shared account) — remove that user_id from the array and restart the daemon.

### Why the Doctor / auth-list surface is intentionally narrowed

- `/doctor` only exposes the root call — side-effecting options like `--refresh-live` are blocked. Prevents unintended token refresh attempts via remote commands.
- `/auth_list` also ignores provider filters / `--help`. Only the account list is exposed.

## Limitations / FAQ

### Bot doesn't respond

1. Is the daemon alive? `systemctl --user status token-weather-bot.service` or `ps aux | grep telegram`.
2. Does the `getMe API` result in `telegram check` show `✓`? If `✗`, suspect token expiry / revoke.
3. Is your Telegram user_id in `allowedUserIds`? Adding another user means rerunning setup (pairing) or manually editing config and restarting the daemon.

### user_id vs chat_id

token-weather's allowlist is based on `ctx.from.id` (the user's user_id) — the same user can issue commands from DM or group chat. It's not based on `chat.id` (the chat room id), so adding the bot to a group does not let other users in that group issue commands.

### 4096-character limit

The Telegram message limit (4096 characters + HTML entity expansion after escape) is respected with a safety margin via automatic split. If multi-account status output is long, it's split across multiple messages.

### Webhook not supported

Only long-poll is supported. Webhooks (which need a public HTTPS endpoint) are intentionally excluded — impractical for typical local user environments (NAT, dynamic IP).

## See also

- Package: `@token-weather/telegram` (npm)
- Dependency: `grammy` ^1.42
- Security reporting: [SECURITY.md](../SECURITY.md)
- Full API: `import * as telegram from '@token-weather/telegram'` — pairing helpers / OS service templates / handler factories / dispatcher / subcommand entry / formatters / help texts are all exported. For the exact list see [`packages/telegram/src/index.js`](../packages/telegram/src/index.js).
