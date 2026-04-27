/**
 * Repo-level install-smoke 정책 회귀 가드.
 *
 * publish 직전 npm install 깨짐을 자동 검증하는 scripts/install-smoke.sh
 * 와 .github/workflows/ci.yml의 install-smoke job 메타데이터가 우발적으로
 * 깨지는 회귀를 막는 파일시스템 단위 검증.
 *
 * 도메인이 다른 repo-policy-{license, publish, readme, types, release}.test.js
 * 와 분리해 install smoke 측면만 검증.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

function readText(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function repoFileExists(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

const SCRIPT_REL = 'scripts/install-smoke.sh';
const WORKFLOW_REL = '.github/workflows/ci.yml';

describe('repo-policy/install-smoke — script (PR #75)', () => {
  it(`${SCRIPT_REL} 가 존재한다`, () => {
    assert.equal(repoFileExists(SCRIPT_REL), true);
  });

  it(`${SCRIPT_REL} 가 executable 비트를 가진다 (chmod +x)`, () => {
    const stat = fs.statSync(path.join(REPO_ROOT, SCRIPT_REL));
    // owner / group / other 중 한 곳이라도 execute 비트가 있으면 PASS.
    // Linux/macOS에서 chmod +x는 보통 0o755 → mode & 0o111 != 0.
    assert.ok((stat.mode & 0o111) !== 0, `mode=${stat.mode.toString(8)} (no exec bit)`);
  });

  it(`${SCRIPT_REL} 핵심 단계가 모두 포함되어 있다`, () => {
    const text = readText(SCRIPT_REL);
    // 단계 누락 회귀를 잡기 위한 grep — 표현은 다소 덮을 수 있도록 키워드 단위.
    assert.match(text, /set -euo pipefail/);
    assert.match(text, /npm run build:types/);
    assert.match(text, /npm pack --workspaces/);
    assert.match(text, /mktemp -d/);
    assert.match(text, /npm install --no-package-lock/);
    // bin smoke 호출 — 위치 무관, --help 가 등장해야 함
    assert.match(text, /token-weather.*--help|--help.*token-weather|"\$BIN" --help/);
    // d.ts 검증 단계
    assert.match(text, /dist\/types\/index\.d\.ts/);
  });
});

describe('repo-policy/install-smoke — CI workflow (PR #75)', () => {
  it(`${WORKFLOW_REL} 에 install-smoke job 이 존재한다`, () => {
    const text = readText(WORKFLOW_REL);
    assert.match(text, /^\s*install-smoke:\s*$/m);
  });

  it(`${WORKFLOW_REL} install-smoke job 이 scripts/install-smoke.sh 를 호출한다`, () => {
    const text = readText(WORKFLOW_REL);
    assert.match(text, /bash\s+\.\/scripts\/install-smoke\.sh/);
  });

  it(`${WORKFLOW_REL} 가 실패 시 packs/ artifact 를 업로드한다`, () => {
    const text = readText(WORKFLOW_REL);
    // failure 시 actions/upload-artifact 사용 + path: packs/
    assert.match(text, /actions\/upload-artifact/);
    assert.match(text, /path:\s*packs\/?/);
  });
});
