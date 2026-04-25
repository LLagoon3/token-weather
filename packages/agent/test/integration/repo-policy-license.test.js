/**
 * Repo-level 라이선스 정책 회귀 가드.
 *
 * 4개 package.json의 license 필드, 루트 LICENSE 파일, README/CONTRIBUTING의
 * 라이선스 단락이 우발적으로 깨지는 것을 막는 파일시스템 단위 검증.
 *
 * `repo-policy.test.js`(보안/템플릿 가드)와 도메인이 달라 별도 파일로 분리.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function repoFileExists(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

function readPackageJson(relPath) {
  return JSON.parse(readRepoFile(relPath));
}

const PUBLISHABLE_PACKAGES = [
  'package.json',
  'packages/agent/package.json',
  'packages/provider-adapters/package.json',
  'packages/schemas/package.json',
];

describe('repo-policy/license — Apache-2.0 (PR #69)', () => {
  it('LICENSE 파일이 repo 루트에 존재한다', () => {
    assert.equal(repoFileExists('LICENSE'), true);
  });

  it('LICENSE 가 Apache License 2.0임을 첫 줄에서 식별 가능', () => {
    const body = readRepoFile('LICENSE');
    assert.match(body, /Apache License/);
    assert.match(body, /Version 2\.0/);
  });

  it('루트 + 3개 publishable package.json 모두 license 필드가 Apache-2.0', () => {
    for (const relPath of PUBLISHABLE_PACKAGES) {
      const pkg = readPackageJson(relPath);
      assert.equal(
        pkg.license,
        'Apache-2.0',
        `${relPath} license 필드가 Apache-2.0 이 아님: ${pkg.license}`,
      );
    }
  });

  it('README 에 "추후 결정" 문구가 남아있지 않다', () => {
    const body = readRepoFile('README.md');
    assert.equal(body.includes('추후 결정'), false);
  });

  it('README 에 LICENSE 파일 링크가 존재한다', () => {
    const body = readRepoFile('README.md');
    // (./LICENSE) 또는 (LICENSE) 형태로 링크
    assert.match(body, /\((?:\.\/)?LICENSE\)/);
  });

  it('CONTRIBUTING 에 Apache-2.0 키워드와 기여자 라이선스 단락이 존재', () => {
    const body = readRepoFile('CONTRIBUTING.md');
    assert.match(body, /Apache-2\.0/);
    assert.match(body, /기여자 라이선스|Submission of Contributions/);
  });
});
