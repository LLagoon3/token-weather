#!/usr/bin/env bash
# Inner script for record-demo.sh — runs inside the isolated HOME with
# asciinema recording. Each command is a discrete demo step; sleeps control
# pacing so the SVG is readable.
#
# **DO NOT RUN THIS SCRIPT DIRECTLY.** Always invoke through
# scripts/record-demo.sh, which sets up an isolated HOME via mktemp. Direct
# execution would read the user's real ~/.config/token-weather/auth.json
# and leak account identifiers / token metadata into the recording.
#
# Constraints:
#   - No real OAuth (`--mock` is always used)
#   - No real network calls beyond what `auth login --manual --mock` does
#   - All output stays inside the recording, redirected to TMP_HOME

set -u

# Safety gate: refuse to run unless the parent (record-demo.sh) explicitly set
# TOKEN_WEATHER_DEMO_SAFE=1. Prevents accidental direct execution from leaking
# real auth.json contents.
if [[ "${TOKEN_WEATHER_DEMO_SAFE:-0}" != "1" ]]; then
  cat >&2 <<'EOF'
ERROR: demo-script.sh must be invoked through scripts/record-demo.sh.

Direct execution would read your real ~/.config/token-weather/auth.json
and expose account identifiers / token metadata in the recording.

Run instead:

  bash scripts/record-demo.sh

If you really need to test demo-script.sh standalone, set up an isolated
HOME yourself and export TOKEN_WEATHER_DEMO_SAFE=1.
EOF
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${REPO_ROOT}/packages/agent/bin/token-weather.js"

# Banner
printf '\n# Token Weather — 1분 demo\n\n'
sleep 1.5

# Step 1: --help
printf '$ token-weather --help\n'
node "${BIN}" --help
sleep 2.5

# Step 2: config init
printf '\n$ token-weather config init\n'
node "${BIN}" config init
sleep 2

# Step 3: auth login claude --manual --mock (no network)
#
# raw code paste 흐름:
#   - demo 는 fake "raw code" 1줄을 paste해 'manual paste 모드' → 'code 수신
#     완료: fake-demo-code' → '--mock 분기 진입 → mock 계정 저장' 시퀀스를
#     보여준다.
#   - state 검증은 raw code paste에서는 expectedState로 채워 통과 (extractAnd
#     ValidateManualPaste의 의도된 관용 — callback URL이 길어 paste 어려운 환경
#     호환). callback URL paste 시에는 state mismatch면 'state-mismatch' 에러로
#     조기 종료.
#   - --mock 명시로 실 token endpoint 호출 0건. demo의 시각적 가치는
#     "manual flow가 실제로 동작함"을 보여주는 것.
printf '\n$ echo "fake-demo-code" | token-weather auth login claude --manual --mock\n'
echo "fake-demo-code" | node "${BIN}" auth login claude --manual --mock 2>/dev/null || true
sleep 2.5

# Step 4: auth list
printf '\n$ token-weather auth list\n'
node "${BIN}" auth list
sleep 3

# Step 5: status (empty store / mock data — outputs sections cleanly)
printf '\n$ token-weather status\n'
node "${BIN}" status
sleep 3.5

# Step 6: status --json (single line JSON)
printf '\n$ token-weather status --json | head -c 200\n'
node "${BIN}" status --json | head -c 200
echo
sleep 2.5

# Step 7: doctor
printf '\n$ token-weather doctor\n'
node "${BIN}" doctor
sleep 3

# Step 8: provider filter
printf '\n$ token-weather status --provider claude\n'
node "${BIN}" status --provider claude
sleep 3

printf '\n# 자세한 명령은 token-weather <command> --help / docs/ 참고.\n'
sleep 1.5
