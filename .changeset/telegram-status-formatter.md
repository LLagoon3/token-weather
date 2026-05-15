---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

feat(telegram): `/status`, `/usage` Telegram 응답을 모바일 폭 친화 compact 출력으로
교체 (issue #144).

기존에는 CLI 의 `formatStatusOutput` (데스크탑 80+ column 가정 — `╭─` rounded box +
`━━━━ ... ━━━━━` 50–55 column heavy rule + 50 column progress bar) 출력을 그대로
`<pre>` 로 감싸 보냈는데, 텔레그램 모바일 (폭 ~30–40 column) 에서 본문이 word
wrap 되어 박스가 갈라지는 회귀가 있었음.

**변경 사항**:

- `@token-weather/telegram` 에 모바일 폭 친화 formatter 추가:
  - `formatStatusForTelegram(snapshot, ctx?) → string[]` — 라인 폭 ≤ 32 column,
    `━━ Title ━━` 짧은 section 라벨, 박스 / 50-column progress bar 미사용
  - `compactResetTime(isoDate, now?) → string` — `9:42pm` / `Sat 4:42am` /
    `May 22 3am` 형식. timezone 표기 생략 (모바일 폭 확보)
  - `TELEGRAM_LINE_WIDTH = 32` 상수
- `status-handler.js` / `usage-handler.js` 가 `deps.formatStatusOutput` 대신
  새 formatter 호출. `formatPreChunksForTelegram` 4096 자 entity-safe chunking
  은 그대로 (PR #134 review 정합).
- `dispatcher.js` 의 `TelegramDeps` jsdoc 에서 `formatStatusOutput` 항목 제거.
- `@token-weather/cli` 의 `run-cli.js` 가 telegram 패키지로 주입하는 deps 에서
  `formatStatusOutput` 항목 제거 (telegram 패키지가 더 이상 요구하지 않음).
  CLI 평문 (`token-weather status` 데스크탑) / `--json` contract 는 변경 없음.

**Non-goal**:

- CLI 평문 출력 변경 — `formatStatusOutput` 는 데스크탑 사용자용으로 그대로 유지.
- `--json` stable contract 변경 없음.
- doctor / auth_list / status-json 핸들러는 폭 가정이 없어 영향 없음.
