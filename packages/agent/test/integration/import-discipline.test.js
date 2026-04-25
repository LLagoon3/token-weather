/**
 * Import discipline 회귀 가드.
 *
 * 워크스페이스 경계를 가로지르는 상대 경로 import (`../../../`)가 새 PR로
 * 다시 들어오는 것을 자동으로 잡는다. publish 후 node_modules 환경에서
 * 깨지는 가장 흔한 패턴이라 가드 비용 대비 효과가 크다.
 *
 * - packages/agent/src/, test/
 * - packages/provider-adapters/src/, test/
 * - packages/schemas/src/, test/
 *
 * 검사 패턴: 세 단계 이상의 상대 경로(parent x3)로 시작하는 정적 / 동적 import.
 * 같은 워크스페이스 내부의 두 단계(parent x2) 깊이는 허용.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

const SCAN_ROOTS = [
  'packages/agent/src',
  'packages/agent/test',
  'packages/provider-adapters/src',
  'packages/provider-adapters/test',
  'packages/schemas/src',
  'packages/schemas/test',
];

function* walkJsFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkJsFiles(full);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      yield full;
    }
  }
}

const CROSS_WORKSPACE_IMPORT = /from\s+['"]\.\.\/\.\.\/\.\.\//;
const CROSS_WORKSPACE_DYNAMIC = /import\(\s*['"]\.\.\/\.\.\/\.\.\//;

describe('import-discipline — 워크스페이스 경계 위반 0건', () => {
  for (const relRoot of SCAN_ROOTS) {
    it(`${relRoot} 안에 cross-workspace 상대 import 가 없다`, () => {
      const root = path.join(REPO_ROOT, relRoot);
      const violations = [];
      for (const file of walkJsFiles(root)) {
        const body = fs.readFileSync(file, 'utf8');
        const lines = body.split('\n');
        lines.forEach((line, idx) => {
          if (CROSS_WORKSPACE_IMPORT.test(line) || CROSS_WORKSPACE_DYNAMIC.test(line)) {
            violations.push(`${path.relative(REPO_ROOT, file)}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
      assert.equal(
        violations.length,
        0,
        `cross-workspace 상대 import 발견:\n${violations.join('\n')}\n\n@token-weather/<pkg>/... 형식으로 변경하세요.`,
      );
    });
  }
});
