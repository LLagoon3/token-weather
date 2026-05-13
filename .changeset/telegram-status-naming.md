---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

refactor(telegram)!: installer / uninstaller status `'installed'` → `'succeeded'` (issue #142).

PR #140 (issue #138) review 라운드 2 에서 분리된 follow-up. 기존
`uninstallOsService` 가 정상 완료 시 `{ status: 'installed' }` 를 반환해 외부
consumer 가 "uninstalled 인데 status 가 installed?" 로 헷갈리던 contract 를 단일
`'succeeded' | 'skipped' | 'failed'` 로 통일.

**변경 사항**:

- `installOsService` / `installSystemdUnit` / `installLaunchAgent` /
  `installTaskScheduler` 의 정상 완료 반환: `'installed'` → `'succeeded'`.
- `uninstallOsService` / `uninstallSystemdUnit` / `uninstallLaunchAgent` /
  `uninstallTaskScheduler` 의 정상 완료 반환: `'installed'` → `'succeeded'`.
- `InstallResult` typedef 의 status union: `'installed' | 'skipped' | 'failed'` →
  `'succeeded' | 'skipped' | 'failed'`.
- 호출 측 분기 (`setup-subcommand.js` / `uninstall-service-subcommand.js`) 갱신.

**Breaking change** — `@token-weather/telegram` 의 public API result shape 변경.
PR #140 (이전 release) 의 result 와 호환 안 됨. 다만 PR #140 이 publish 전이라
**외부 사용자가 본 API 에 의존하기 전에 처리** 하는 게 본 PR 의 의도.

본 PR 머지 후 누적 release PR 머지 → v0.5.0 publish 시점에 `'succeeded'` 가
첫 공식 contract.

**Migration** (PR #140 의 pre-publish 사용자 한정):

```diff
- if (result.status === 'installed') { ... }
+ if (result.status === 'succeeded') { ... }
```
