/**
 * Repo-level lint / format 정책 회귀 가드.
 *
 * #53 의 ESLint 9 flat config + Prettier 셋업 메타데이터(devDeps / 설정 파일 /
 * root scripts / CI lint job) 가 우발적으로 깨지는 회귀를 막는 파일시스템 단위
 * 검증.
 *
 * 도메인이 다른 repo-policy-{license,publish,readme,types,release,install-smoke}
 * .test.js 와 분리해 lint 측면만 검증.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'));
}

function readText(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function repoFileExists(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

const ROOT = readJson('package.json');

describe('repo-policy/lint — devDependencies (PR #53)', () => {
  it('루트 package.json 에 ESLint 관련 devDeps 가 선언되어 있다', () => {
    assert.ok(ROOT.devDependencies, 'devDependencies 누락');
    for (const dep of ['eslint', '@eslint/js', 'globals', 'eslint-config-prettier']) {
      assert.equal(typeof ROOT.devDependencies[dep], 'string', `${dep} 누락`);
    }
  });

  it('루트 package.json 에 prettier devDep 이 선언되어 있다', () => {
    assert.equal(typeof ROOT.devDependencies.prettier, 'string');
  });
});

describe('repo-policy/lint — config 파일 (PR #53)', () => {
  it('eslint.config.js 가 root 에 존재 (flat config)', () => {
    assert.equal(repoFileExists('eslint.config.js'), true);
    const text = readText('eslint.config.js');
    // ESM flat config 의 표식
    assert.match(text, /from\s+['"]@eslint\/js['"]/);
    assert.match(text, /export default \[/);
  });

  it('.prettierrc.json 이 root 에 존재', () => {
    assert.equal(repoFileExists('.prettierrc.json'), true);
    const cfg = readJson('.prettierrc.json');
    // 본 repo 의 결정값 — 회귀 시 발견 (단, 후속에서 의도적 변경되면 함께 갱신)
    assert.equal(cfg.singleQuote, true);
    assert.equal(cfg.semi, true);
  });

  it('.prettierignore 가 root 에 존재', () => {
    assert.equal(repoFileExists('.prettierignore'), true);
  });
});

describe('repo-policy/lint — root scripts (PR #53)', () => {
  it('lint / lint:fix / format / format:check 스크립트가 모두 존재', () => {
    assert.ok(ROOT.scripts);
    for (const name of ['lint', 'lint:fix', 'format', 'format:check']) {
      assert.equal(typeof ROOT.scripts[name], 'string', `scripts.${name} 누락`);
      // placeholder 'echo "TODO ..."' 패턴이 다시 들어오는 회귀 차단
      assert.equal(
        /^echo\b/.test(ROOT.scripts[name]),
        false,
        `scripts.${name} 가 placeholder 로 회귀`,
      );
    }
  });

  it('build / dev 스크립트가 placeholder 가 아닌 실제 명령', () => {
    assert.ok(ROOT.scripts);
    for (const name of ['build', 'dev']) {
      const cmd = ROOT.scripts[name];
      assert.equal(typeof cmd, 'string', `scripts.${name} 누락`);
      assert.equal(/^echo\b/.test(cmd), false, `scripts.${name} 가 placeholder 로 회귀`);
    }
  });

  it('build 스크립트가 build:types 를 호출 (무빌드 정책 정합)', () => {
    assert.match(ROOT.scripts.build, /build:types/);
  });
});

describe('repo-policy/lint — CI workflow (PR #53)', () => {
  it('.github/workflows/ci.yml 에 lint job 이 존재', () => {
    const text = readText('.github/workflows/ci.yml');
    assert.match(text, /^\s*lint:\s*$/m);
  });

  it('lint job 이 npm run lint + format:check 둘 다 호출', () => {
    const text = readText('.github/workflows/ci.yml');
    assert.match(text, /npm run lint(?!:)/);
    assert.match(text, /npm run format:check/);
  });
});
