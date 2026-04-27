/**
 * Repo-level TypeScript types 정책 회귀 가드.
 *
 * .d.ts 동봉 정책(#73)의 핵심 메타데이터(tsconfig / scripts.build:types /
 * package.json types 필드 / files dist/types / typescript devDep)이 우발적으로
 * 깨지는 회귀를 막는 파일시스템 단위 검증.
 *
 * `repo-policy-publish.test.js`(publish 메타), `repo-policy-license.test.js`,
 * `repo-policy-readme.test.js`와 도메인이 달라 별도 파일로 분리.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

function readPackageJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'));
}

function repoFileExists(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

const ROOT = readPackageJson('package.json');
const AGENT = readPackageJson('packages/agent/package.json');
const ADAPTERS = readPackageJson('packages/provider-adapters/package.json');
const SCHEMAS = readPackageJson('packages/schemas/package.json');

const PUBLISHABLE = [
  ['agent', AGENT, 'packages/agent'],
  ['provider-adapters', ADAPTERS, 'packages/provider-adapters'],
  ['schemas', SCHEMAS, 'packages/schemas'],
];

describe('repo-policy/types — typescript devDep + base tsconfig (PR #73)', () => {
  it('루트 package.json에 typescript devDep 선언', () => {
    assert.ok(ROOT.devDependencies, 'devDependencies 누락');
    assert.equal(typeof ROOT.devDependencies.typescript, 'string');
  });

  it('루트 scripts.build:types 가 존재한다', () => {
    assert.ok(ROOT.scripts);
    assert.equal(typeof ROOT.scripts['build:types'], 'string');
    // 의존 순서가 명시적으로 들어있는지 (schemas → adapters → cli)
    assert.match(
      ROOT.scripts['build:types'],
      /schemas.*provider-adapters.*cli/s,
      '루트 build:types는 schemas → provider-adapters → cli 순차여야 함',
    );
  });

  it('tsconfig.base.json 이 존재하며 emitDeclarationOnly + declaration 활성화', () => {
    assert.equal(repoFileExists('tsconfig.base.json'), true);
    const base = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'tsconfig.base.json'), 'utf8'),
    );
    assert.equal(base.compilerOptions?.declaration, true);
    assert.equal(base.compilerOptions?.emitDeclarationOnly, true);
    assert.equal(base.compilerOptions?.allowJs, true);
  });
});

describe('repo-policy/types — 패키지별 tsconfig + types 필드 (PR #73)', () => {
  for (const [label, pkg, dir] of PUBLISHABLE) {
    it(`${label} 의 tsconfig.json 이 존재한다`, () => {
      assert.equal(repoFileExists(`${dir}/tsconfig.json`), true);
    });

    it(`${label} 의 tsconfig 가 base를 extends 한다`, () => {
      const cfg = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, `${dir}/tsconfig.json`), 'utf8'),
      );
      assert.match(cfg.extends ?? '', /tsconfig\.base\.json$/);
    });

    it(`${label} package.json 에 types: "./dist/types/index.d.ts"`, () => {
      assert.equal(pkg.types, './dist/types/index.d.ts');
    });

    it(`${label} files 배열에 "dist/types" 포함`, () => {
      assert.ok(pkg.files);
      assert.ok(
        pkg.files.includes('dist/types'),
        `${label} files: ${JSON.stringify(pkg.files)} (dist/types 누락)`,
      );
    });

    it(`${label} scripts.build:types 존재`, () => {
      assert.ok(pkg.scripts);
      assert.equal(typeof pkg.scripts['build:types'], 'string');
    });
  }
});

// CI 전용: build:types 산출물(.d.ts) 실제 존재 검증.
// local에서 build:types를 안 돌리고 npm test만 실행하면 dist/types가 없을 수
// 있어 false positive를 만든다. CI에서는 'npm run build:types' 다음에
// 'npm test'가 실행되므로 산출물이 항상 존재.
const CI_ONLY = process.env.CI === 'true';

describe('repo-policy/types — build 산출물 (CI gate)', { skip: !CI_ONLY }, () => {
  for (const [label, _pkg, dir] of PUBLISHABLE) {
    it(`${label} 의 dist/types/index.d.ts 가 build:types 후 존재`, () => {
      assert.equal(repoFileExists(`${dir}/dist/types/index.d.ts`), true);
    });
  }
});
