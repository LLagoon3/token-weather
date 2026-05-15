---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

feat(telegram): `/status`, `/usage` Telegram 응답의 window 라인에 progress bar 추가
(issue #146).

PR #145 (#144) 에서 모바일 폭 친화 compact 출력을 위해 제거했던 사용량 시각화를
복원. CLI 의 `formatProgressBar` (width=50, ANSI 컬러) 를 그대로 쓰면 모바일 폭에
박스가 깨지므로, Telegram `<pre>` 환경에 맞춰 ANSI 분기를 뺀 10-column 사본을
추가.

**변경 사항**:

- `@token-weather/telegram` public export 추가:
  - `compactProgressBar(percent, width = 10) → string` — 1/8 정밀도 fractional
    block (`█▏▎▍▌▋▊▉`) + light shade `░`. ANSI 컬러 미적용 (Telegram `<pre>` HTML
    미지원). null/NaN → 전부 `░`. 범위 외 → `[0, 100]` clamp.
- `formatStatusForTelegram` 의 window 라인 포맷 갱신:
  - before: `· primary: 38%`
  - after: `· primary   ███▊░░░░░░  38%`
- 라인 폭: `· ` (2) + label `padEnd(9)` + space + bar (10) + space + pct
  `padStart(4)` = **27 자** ≤ 32 column 가이드 유지.
- 박스 글리프 (`╭ │ ╰ ┌ └ ─`) 회귀 가드는 그대로 유지 — bar 글리프 (`█ ░`) 만
  단언 배열에서 제거하고 "모든 window 라인에 bar 글리프 존재" 단언 추가.

**Non-goal**:

- CLI 평문 (`token-weather status` 데스크탑) 변경 — `formatProgressBar` 와
  컬러 정책 그대로 유지.
- `--json` stable contract 변경 없음.
- 컬러 / 상태 emoji (🟢🟡🔴) 는 별도 후속 이슈 후보.
