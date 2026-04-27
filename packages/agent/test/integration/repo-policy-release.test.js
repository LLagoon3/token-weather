/**
 * Repo-level release 정책 회귀 가드.
 *
 * Changesets 기반 release 운영(#74)의 핵심 메타데이터가 우발적으로 깨지는
 * 회귀를 막는 파일시스템 단위 검증:
 *  - 루트 @changesets/cli devDep
 *  - .changeset/config.json (linked / baseBranch / access)
 *  - docs/release-policy.md 핵심 섹션
 *  - CHANGELOG.md (Keep a Changelog 포맷 hint)
 *  - .github/workflows/release.yml (changesets/action, publish step 부재)
 *
 * 도메인이 다른 repo-policy-{license, publish, readme, types}.test.js와
 * 분리해 release 운영 측면만 검증.
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

describe('repo-policy/release — Changesets 셋업 (PR #74)', () => {
  it('루트 package.json 에 @changesets/cli devDep 이 선언되어 있다', () => {
    assert.ok(ROOT.devDependencies, 'devDependencies 누락');
    assert.equal(typeof ROOT.devDependencies['@changesets/cli'], 'string');
  });

  it('.changeset/config.json 이 존재한다', () => {
    assert.equal(repoFileExists('.changeset/config.json'), true);
  });

  it('.changeset/config.json 의 baseBranch / access / linked 필드가 정책과 일치', () => {
    const cfg = readJson('.changeset/config.json');
    assert.equal(cfg.baseBranch, 'dev');
    assert.equal(cfg.access, 'public');
    assert.ok(Array.isArray(cfg.linked) && cfg.linked.length === 1);
    const group = cfg.linked[0];
    assert.ok(group.includes('@token-weather/cli'));
    assert.ok(group.includes('@token-weather/provider-adapters'));
    assert.ok(group.includes('@token-weather/schemas'));
  });

  it('.changeset/README.md (기여자 안내) 가 존재한다', () => {
    assert.equal(repoFileExists('.changeset/README.md'), true);
  });
});

describe('repo-policy/release — docs / CHANGELOG (PR #74)', () => {
  it('docs/release-policy.md 가 핵심 섹션을 포함한다', () => {
    const text = readText('docs/release-policy.md');
    // semver 트리거 / SCHEMA_VERSION / CHANGELOG / release PR 흐름 4개 섹션이
    // PR 리뷰에서 인용 가능하도록 유지되어야 함
    assert.match(text, /semver/i);
    assert.match(text, /SCHEMA_VERSION/);
    assert.match(text, /CHANGELOG/);
    assert.match(text, /release PR/i);
  });

  it('CHANGELOG.md 가 Keep a Changelog 포맷의 핵심 표식을 가진다', () => {
    assert.equal(repoFileExists('CHANGELOG.md'), true);
    const text = readText('CHANGELOG.md');
    assert.match(text, /## \[Unreleased\]/);
    assert.match(text, /## \[0\.1\.0\]/);
    assert.match(text, /### Added/);
    // 카테고리 안내가 사라지면 작성자가 어떤 섹션에 넣을지 모르게 됨
    for (const cat of ['Changed', 'Fixed', 'Security']) {
      assert.match(text, new RegExp(`### ${cat}`));
    }
  });
});

describe('repo-policy/release — release workflow (PR #74)', () => {
  it('.github/workflows/release.yml 이 존재한다', () => {
    assert.equal(repoFileExists('.github/workflows/release.yml'), true);
  });

  it('release.yml 이 changesets/action 을 사용한다', () => {
    const text = readText('.github/workflows/release.yml');
    assert.match(text, /uses:\s*changesets\/action/);
  });

  it('release.yml 에 publish step 이 아직 없다 (의도적 — #76 범위)', () => {
    const text = readText('.github/workflows/release.yml');
    // 'publish: <command>' 형태의 yaml key가 changesets/action with: 블록에
    // 들어오는 순간 실제 npm publish가 실행됨. 본 PR(#74)에서는 명시적 미포함.
    assert.equal(/^\s*publish:\s*\S/m.test(text), false);
  });
});
