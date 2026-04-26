#!/usr/bin/env bash
# Record the README demo as an SVG asciicast.
#
# Output:
#   docs/assets/demo.cast  — raw asciinema cast (replayable)
#   docs/assets/demo.svg   — embedded in README
#
# Safety:
#   - Runs inside an isolated HOME (mktemp) so real auth.json / Claude
#     credentials are never read.
#   - Uses `auth login --manual` with a fake code (no network OAuth).
#   - After recording, greps the SVG for token-shaped strings and aborts
#     publish if any are found.
#
# Requires: asciinema, agg, jq (last optional, used in demo for status --json).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="${REPO_ROOT}/docs/assets"
CAST_FILE="${ASSETS_DIR}/demo.cast"
SVG_FILE="${ASSETS_DIR}/demo.svg"

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: '$1' is required but not installed." >&2
    case "$1" in
      asciinema) echo "  Install: pipx install asciinema  (or your distro's package)" >&2 ;;
      agg)       echo "  Install: cargo install --git https://github.com/asciinema/agg" >&2 ;;
      jq)        echo "  Install: your distro's jq package" >&2 ;;
    esac
    exit 1
  fi
}

require_tool asciinema
require_tool agg

mkdir -p "${ASSETS_DIR}"

TMP_HOME="$(mktemp -d -t token-weather-demo-XXXXXX)"
cleanup() { rm -rf "${TMP_HOME}"; }
trap cleanup EXIT

echo "Recording demo into isolated HOME=${TMP_HOME}"
HOME="${TMP_HOME}" \
NO_COLOR=1 \
TOKEN_WEATHER_DEMO_SAFE=1 \
asciinema rec \
  --cols 100 \
  --rows 32 \
  --idle-time-limit 1.5 \
  --overwrite \
  --command "bash ${REPO_ROOT}/scripts/demo-script.sh" \
  "${CAST_FILE}"

echo ""
echo "Rendering SVG..."
agg --font-size 14 --theme monokai "${CAST_FILE}" "${SVG_FILE}"

echo ""
echo "Verifying no token-shaped strings leaked into demo.svg..."
if grep -E '(accessToken|refreshToken|idToken|sessionKey|sessionCookie|sk-[A-Za-z0-9]{10,}|Bearer +[A-Za-z0-9])' "${SVG_FILE}" >/dev/null 2>&1; then
  echo "ERROR: token-shaped string found in ${SVG_FILE}. Re-record after redaction." >&2
  exit 1
fi
echo "OK — no token-shaped strings in SVG."
echo ""
echo "Output:"
echo "  ${CAST_FILE}"
echo "  ${SVG_FILE}"
