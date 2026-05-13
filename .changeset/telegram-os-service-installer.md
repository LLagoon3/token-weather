---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

feat(telegram): OS service 자동 등록 옵션 — 5+ 줄 셸 명령 → Enter 한 번 (issue #138).

5-phase plan (#126~#130) 의 후속 follow-up. Phase 4 (#129) 의 `telegram setup` 은
OS service template 를 **print 만** 했는데, 본 release 부터 동의 기반 자동 등록을
지원한다. 보안 도구 원칙 유지 — Y default 프롬프트 + 사용자 명시 n / detect skip
시 기존 수동 안내 fallback.

PR #136 review (메시지 #796) 의 오픈클로 게이트웨이 비교에서 출발 → 메시지 #798
의 사용자 결정 사양 (Y default / skip+안내 / service+linger 까지만 uninstall) →
본 release 가 구현.

**신규 동작**:

- `telegram setup` 의 마지막 단계가 `자동으로 설치하시겠습니까? [Y/n]` 프롬프트를
  표시:
  - **Y (default)**: token-weather 가 직접 systemd unit / launchd plist / Task
    Scheduler 항목을 작성 + 활성화 (`systemctl --user enable --now` /
    `launchctl bootstrap` / `schtasks /Create`). Linux 는 `loginctl enable-linger`
    까지 자동 (best-effort).
  - **n**: 자동 등록 건너뜀 → 기존 수동 안내 블록 출력 (Phase 4 와 동일).
  - **systemd / launchctl / schtasks 미감지** (WSL / Docker / Alpine OpenRC 등):
    자동 skip + 수동 안내 fallback. install 실패하지 않음.
- 신규 서브명령 `telegram uninstall-service`:
  - 작성된 service 항목을 confirm (default Y) 후 제거.
  - 책임 범위: service 파일 + Linux linger 까지. **config / auth.json 은 건드리지
    않음** — 봇 설정 자체를 지우려면 사용자가 명시적으로 config 편집.

**신규 public export** (`@token-weather/telegram`):

- `installOsService(input, options)` / `uninstallOsService(options)` — OS detect →
  분기. 미지원 platform 은 `{ status: 'skipped' }`.
- `installSystemdUnit` / `uninstallSystemdUnit` / `installLaunchAgent` /
  `uninstallLaunchAgent` / `installTaskScheduler` / `uninstallTaskScheduler` —
  OS 별 install / uninstall 실 구현.
- `runUninstallServiceSubcommand(args, deps, options?)` —
  `telegram uninstall-service` 의 진입점.
- `formatTelegramUninstallServiceHelp()` — `--help` 안내.
- `parseYesNo(answer, defaultYes)` — Y/N 응답 파싱 helper.

**부수 변경** (`@token-weather/telegram` 의 `os-service-templates.js`):

- `linuxSystemdUnit` / `macosLaunchAgent` 의 반환 객체에 `content` / `serviceFilename`
  키 추가 — installer 가 직접 fs.writeFile 로 작성할 raw unit content. 기존
  `instructions` (manual heredoc) 은 그대로 보존, backward-compat 완전.

**UX 비교**:

| 기존 (#129)                            | 자동 등록 (본 issue)                     |
| -------------------------------------- | ---------------------------------------- |
| 1. setup 끝의 template 블록 보기       | 1. setup 끝의 `자동 설치 [Y/n]` 프롬프트 |
| 2. 5+ 줄 셸 명령 셸에 복사 / 붙여넣기  | 2. Enter → 자동 등록 완료                |
| 3. 무시하고 `telegram start` 수동 실행 | 3. 거부 시 기존 수동 안내 fallback       |

5+ 줄 셸 명령 → Enter 한 번. 보안 원칙 (동의 필요) 유지.

**위험 / Fallback**:

- WSL / Docker container / Alpine OpenRC: `systemctl --version` 등 사전 detect →
  skip + 수동 안내. install 실패 X.
- nvm / fnm path stale: install 완료 메시지에 "Node 버전 매니저 변경 시
  `telegram setup` 재실행 권장" 안내.
- 기존 service 파일 충돌: hash 비교 → 다르면 confirm (default n) → 사용자 명시
  y 시만 덮어쓰기. Windows 도 동일 정책 — `schtasks /Query` 사전 검사 (PR #140
  review blocker 2).
- 충돌 시 confirm 의 실 동작 정합 (PR #140 review blocker 1) — setup 경로에서
  `options.confirmFn` 미주입 시 자동으로 `promptFn` 기반 adapter build, 실제
  프롬프트로 사용자 결정 받음.
- install 중간 실패: try / catch + **backup / restore** (PR #140 review). 기존
  파일이 있었으면 cleanup 시 unlink 대신 restore — 사용자 파일 손실 회피.
- HOME / USER 환경변수 누락 (PR #140 review): HOME 없으면 status 'skipped' + manual
  fallback. USER 없으면 linger 단계만 skip + log 안내.
- 경로 공백 / XML 특수문자 (PR #140 review): 사전 검사 (`hasUnsafePathChars`) →
  발견 시 즉시 status 'skipped' + manual 안내. 정확한 escaping helper 는 별도
  follow-up.
- uninstall 의 linger 비활성화: 다른 user-level service 도 영향 가능 — 안내
  텍스트에 명시.

**config / public API contract** 변경 없음 — `runSetupSubcommand` / `runTelegramCommand`
의 시그니처 그대로, 동작 추가 + 신규 export 만.

**Bump 의도** — `@token-weather/telegram` 의 동작 추가가 본질. linked 정책
(release-policy §1, v0.x 단순성 우선) 으로 4 패키지 모두 minor 가 동시 누적.

**문서**:

- `docs/telegram-bot.md` — §빠른 시작 / §명령 표 / §OS service 등록 모두 갱신.
  자동 등록 / fallback / uninstall-service 흐름 안내. 기존 수동 등록 안내는
  fallback section 으로 보존.
