---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
---

refactor(adapters)!: codex 폴백을 OpenClaw `auth-profiles.json` 에서 Codex CLI 자체 `~/.codex/auth.json` (`codex-cli-import`) 으로 교체 — claude 의 `claude-cli-import` 와 1:1 architectural symmetry (issue #113). 본 도구가 OpenClaw 환경 의존을 끊어내고 npm 일반 사용자에게도 의미 있는 폴백을 제공.

**Breaking changes** (release-policy §1 major 트리거이지만 v0.x convention 상 minor):

- `status --json` 의 `authSource` enum: `'openclaw-import'` 제거 + `'codex-cli-import'` 추가
- `status --json` 의 `codex.authProfilesPath` 필드 → `codex.credentialsPath` (claude 와 동일 표면, `~/.codex/auth.json` 경로)
- public export 제거: `readCodexAuthProfiles` / `getDefaultAuthProfilesPath` (`@token-weather/provider-adapters` 의 codex 영역)
- 신규 public export: `readCodexCliCredentials` / `resolveCodexCliCredentialsPath` / `parseCodexCliCredentials` / `mapCodexCredentials` / `buildImportedCodexAccount` / `resolveImportedCodexAccounts` / `selectCodexAccountsSource` / `resolveImportedCodexSnapshot`
- `SCHEMA_VERSION`: `'0.2.0'` → `'0.3.0'`
- `auth-store-schema.js::CREDENTIAL_SOURCES` enum 정합 (incomplete 였던 enum 도 `'claude-cli-import'` / `'codex-cli-import'` 명시)

**Migration**:

- `status --json` 의 `.providers[].snapshot.authSource === 'openclaw-import'` 분기 → `'codex-cli-import'` 로 갱신
- `.providers[].snapshot.codex.authProfilesPath` 참조 → `.credentialsPath`
- OpenClaw 워크스페이스 사용자: 1회 `token-weather auth login codex` 실행 (또는 OpenClaw 측에서 `~/.config/token-weather/auth.json` 에 직접 inject 하도록 변경 — OpenClaw repo 후속 작업 영역)
- `@token-weather/provider-adapters` 의 `readCodexAuthProfiles` 직접 import 한 consumer → `readCodexCliCredentials` + `buildImportedCodexAccount` 패턴으로 갱신
