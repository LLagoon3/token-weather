#!/usr/bin/env bash
#
# install-smoke.sh — npm pack 결과물의 install 가능성 자동 검증.
#
# Workspace 안에서는 잘 동작해도 실제 npm install 환경에선 깨질 수 있는
# 항목(cross-package 상대 import, files 누락, dist/types 부재, bin shebang
# 권한 등)을 publish 직전에 잡기 위한 스크립트.
#
# 흐름:
#   1) build:types 로 d.ts emit
#   2) npm pack --workspaces 로 4 publishable 패키지 tarball 생성
#   3) 임시 디렉토리에서 4 tarball을 동시 install
#      (cross-package 의존이라 단독 install 시 registry로 가서 fail)
#   4) bin 핵심 명령(--help, auth login claude --help) 실행 → exit 0 확인
#   5) 4 패키지의 dist/types/index.d.ts 가 install된 node_modules에 존재하는지 확인
#
# 안전장치:
#   - HOME 을 mktemp 디렉토리로 override → 사용자 실 ~/.config/token-weather/auth.json
#     절대 접근 안 함.
#   - NO_COLOR=1 로 출력 deterministic.
#   - status / usage / doctor 같은 network 의존 명령은 smoke 대상에서 제외.
#
# 사용:
#   bash scripts/install-smoke.sh        # local 검증
#   CI 에서는 .github/workflows/ci.yml install-smoke job이 동일 호출.
#
# 실패 시: CI는 packs/ 디렉토리를 actions/upload-artifact 로 업로드.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PACKS_DIR="$REPO_ROOT/packs"

echo "▶ 1. build:types"
npm run build:types --silent

echo "▶ 2. npm pack --workspaces → $PACKS_DIR"
rm -rf "$PACKS_DIR"
mkdir -p "$PACKS_DIR"
npm pack --workspaces --pack-destination "$PACKS_DIR" --silent > /dev/null

TARBALL_COUNT=$(find "$PACKS_DIR" -maxdepth 1 -name '*.tgz' -type f | wc -l)
if [ "$TARBALL_COUNT" -ne 4 ]; then
  echo "❌ expected 4 tarballs in $PACKS_DIR, got $TARBALL_COUNT"
  ls -la "$PACKS_DIR" || true
  exit 1
fi
echo "  ✓ 4 tarballs packed"

echo "▶ 3. tmp 디렉토리 install"
TMP=$(mktemp -d -t tw-install-smoke-XXXXXX)
TMP_HOME=$(mktemp -d -t tw-smoke-home-XXXXXX)
trap 'rm -rf "$TMP" "$TMP_HOME"' EXIT

cd "$TMP"
cat > package.json <<'EOF'
{
  "name": "token-weather-install-smoke",
  "private": true,
  "version": "0.0.0"
}
EOF

# 4 tarball을 한 번에 install — cross-package 의존이라 npm이 fs path로 cross-resolve
npm install --no-package-lock --no-audit --no-fund "$PACKS_DIR"/*.tgz > /dev/null
echo "  ✓ install 완료"

echo "▶ 4. bin smoke (--help / auth login claude --help)"
BIN="$TMP/node_modules/.bin/token-weather"
if [ ! -x "$BIN" ]; then
  echo "❌ bin not executable: $BIN"
  ls -la "$TMP/node_modules/.bin/" || true
  exit 1
fi

HOME="$TMP_HOME" NO_COLOR=1 "$BIN" --help > /dev/null
HOME="$TMP_HOME" NO_COLOR=1 "$BIN" auth login claude --help > /dev/null
echo "  ✓ bin 실행 OK"

echo "▶ 5. d.ts 산출물 검증"
for pkg in @token-weather/cli @token-weather/provider-adapters @token-weather/schemas @token-weather/telegram; do
  dts="$TMP/node_modules/$pkg/dist/types/index.d.ts"
  if [ ! -f "$dts" ]; then
    echo "❌ d.ts 누락: $dts"
    exit 1
  fi
done
echo "  ✓ 4 패키지 d.ts 모두 존재"

echo "▶ 6. ESM root import 해상도 검증"
# tmp 프로젝트의 root에서 4 패키지를 직접 import — 실제 publish/install 환경의
# resolution 흐름과 동일. 단순 import 가능성과 알려진 named export 한 개의
# shape 까지만 검증하고 함수는 호출하지 않는다 (side effect 회피).
cat > "$TMP/import-check.mjs" <<'MJS'
import { SCHEMA_VERSION, validateUsageSnapshot } from '@token-weather/schemas';
import * as adapters from '@token-weather/provider-adapters';
import * as cli from '@token-weather/cli';
import * as telegram from '@token-weather/telegram';

const failures = [];
if (typeof SCHEMA_VERSION !== 'string') {
  failures.push(`SCHEMA_VERSION expected string, got ${typeof SCHEMA_VERSION}`);
}
if (typeof validateUsageSnapshot !== 'function') {
  failures.push(`validateUsageSnapshot expected function, got ${typeof validateUsageSnapshot}`);
}
if (typeof adapters !== 'object' || adapters === null || Object.keys(adapters).length === 0) {
  failures.push('@token-weather/provider-adapters resolved but exports look empty');
}
if (typeof cli !== 'object' || cli === null || Object.keys(cli).length === 0) {
  failures.push('@token-weather/cli resolved but exports look empty');
}
if (typeof telegram.runTelegramCommand !== 'function') {
  failures.push(`@token-weather/telegram runTelegramCommand expected function, got ${typeof telegram.runTelegramCommand}`);
}
if (failures.length > 0) {
  for (const f of failures) console.error('❌', f);
  process.exit(1);
}
MJS

HOME="$TMP_HOME" NO_COLOR=1 node "$TMP/import-check.mjs"
echo "  ✓ 4 패키지 ESM root import OK"

echo ""
echo "✓ install smoke passed"
