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

  // #76에서 publish step 활성화. 'publish: <command>' yaml key 가 changesets/
  // action with: 블록에 들어오면 release PR 머지 시 실제 npm publish 실행.
  it('release.yml 에 publish step 이 활성화되어 있다 (#76)', () => {
    const text = readText('.github/workflows/release.yml');
    assert.match(text, /^\s*publish:\s+npx\s+changeset\s+publish/m);
  });

  // Trusted Publishing(OIDC) 단독 운영으로 전환 후 token 의존성이 다시
  // 들어오는 회귀 차단. NPM_TOKEN / NODE_AUTH_TOKEN env 모두 부재해야 한다.
  it('release.yml 에 NPM_TOKEN / NODE_AUTH_TOKEN env 가 없다 (Trusted Publishing 단독)', () => {
    const text = readText('.github/workflows/release.yml');
    assert.equal(/NPM_TOKEN:\s*\$\{\{/.test(text), false, 'NPM_TOKEN env 잔존');
    assert.equal(/NODE_AUTH_TOKEN:\s*\$\{\{/.test(text), false, 'NODE_AUTH_TOKEN env 잔존');
  });

  // publish 직전 안전벨트로 install smoke 스크립트 재호출 (#75 산출물).
  // 도메인 분리: ci.yml install-smoke job 검증은 repo-policy-install-smoke.test.js,
  // 본 단언은 release.yml 의 publish-time 호출만 가드한다.
  it('release.yml 이 publish 직전 install smoke 를 호출한다 (#76)', () => {
    const text = readText('.github/workflows/release.yml');
    assert.match(text, /bash\s+\.\/scripts\/install-smoke\.sh/);
  });

  // npm Trusted Publishing(OIDC) 은 npm CLI 11+ 를 요구한다. Node 24 의
  // 번들 npm 이 11+ 라 self-upgrade 없이 요구사항 충족 — 'npm install -g
  // npm@latest' 자체가 node 22 번들 npm 위에서 깨졌던 회귀(release run
  // 25079605613, MODULE_NOT_FOUND promise-retry) 회피.
  it('release.yml 이 Node 24 를 사용한다 (Trusted Publishing OIDC + npm 11+ 번들)', () => {
    const text = readText('.github/workflows/release.yml');
    assert.match(text, /node-version:\s*24/);
  });

  it('release.yml 에 npm self-upgrade step 이 없다 (회귀 차단)', () => {
    const text = readText('.github/workflows/release.yml');
    // global npm 자기 업그레이드 패턴은 release.yml 에 다시 들어오면 안 됨.
    // (코멘트의 historical reference 도 false-positive 가 안 되도록 코멘트
    // 처음에 'global npm 자기 업그레이드' 한국어 표현 사용.)
    assert.equal(/^\s*-?\s*run:\s*npm install -g npm@/m.test(text), false);
  });

  // npm provenance (OIDC) — Trusted Publisher 등록 완료 후 재활성화.
  // id-token: write 권한 + NPM_CONFIG_PROVENANCE: 'true' 가 함께 있어야
  // changesets 가 호출하는 npm publish 에 supply chain attestation 적용.
  it('release.yml job 이 id-token: write 권한을 갖는다 (provenance OIDC)', () => {
    const text = readText('.github/workflows/release.yml');
    assert.match(text, /^\s*id-token:\s*write/m);
  });

  it('release.yml 이 NPM_CONFIG_PROVENANCE 를 활성화한다 (provenance)', () => {
    const text = readText('.github/workflows/release.yml');
    assert.match(text, /NPM_CONFIG_PROVENANCE:\s*['"]?true['"]?/);
  });

  // FF sync — publish 직후 main 을 dev tip 으로 자동 FF push 하는 step 이
  // main 의 자동 동기 mirror 보장의 핵심. 이 step 이 사라지면 main 이 다시
  // 정체되어 docs/*-merge-followup 같은 수동 정합 PR 패턴이 부활한다.
  it('release.yml 에 publish 후 main FF sync step 이 있다', () => {
    const text = readText('.github/workflows/release.yml');
    // step 식별 — "FF sync main = dev tip" 표현 + main 으로의 git push
    assert.match(text, /FF sync main.*dev tip/);
    assert.match(text, /git push origin HEAD:main/);
    // published gate — version mode (release PR 갱신만) 에서는 동작 안 함
    assert.match(text, /steps\.changesets\.outputs\.published/);
  });

  // 위 FF sync 의 published gate 가 동작하려면 changesets/action step 에
  // id 가 부여되어야 한다. id 가 없으면 outputs 참조가 깨져 gate 가
  // 항상 false 가 되거나 syntax 오류가 발생한다.
  it('release.yml 의 changesets/action step 에 id: changesets 가 있다', () => {
    const text = readText('.github/workflows/release.yml');
    assert.match(text, /uses:\s*changesets\/action@v1\s*\n\s*id:\s*changesets/);
  });
});
