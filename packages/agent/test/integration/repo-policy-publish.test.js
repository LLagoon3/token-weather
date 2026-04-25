/**
 * Repo-level publish 메타데이터 회귀 가드.
 *
 * 3개 publishable 패키지의 npm publish 시 필요한 메타데이터(name, private,
 * publishConfig, dependencies, files, bin, engines)가 누락되거나 변형되는
 * 회귀를 막는 파일시스템 단위 검증.
 *
 * `repo-policy.test.js`(보안/템플릿 가드), `repo-policy-license.test.js`(라이선스 가드)와
 * 도메인이 달라 별도 파일로 분리.
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

const AGENT = readPackageJson('packages/agent/package.json');
const ADAPTERS = readPackageJson('packages/provider-adapters/package.json');
const SCHEMAS = readPackageJson('packages/schemas/package.json');

describe('repo-policy/publish — 패키지 이름 (Token Weather)', () => {
  it('agent 패키지명이 @token-weather/cli', () => {
    assert.equal(AGENT.name, '@token-weather/cli');
  });

  it('provider-adapters 패키지명이 @token-weather/provider-adapters', () => {
    assert.equal(ADAPTERS.name, '@token-weather/provider-adapters');
  });

  it('schemas 패키지명이 @token-weather/schemas', () => {
    assert.equal(SCHEMAS.name, '@token-weather/schemas');
  });
});

describe('repo-policy/publish — publishable 상태', () => {
  it('3개 패키지 모두 private 필드가 없거나 false (publish 가능)', () => {
    for (const [label, pkg] of [['agent', AGENT], ['provider-adapters', ADAPTERS], ['schemas', SCHEMAS]]) {
      assert.notEqual(pkg.private, true, `${label} 가 private: true`);
    }
  });

  it('3개 패키지 모두 publishConfig.access === public (스코프 패키지 publish 필수)', () => {
    for (const [label, pkg] of [['agent', AGENT], ['provider-adapters', ADAPTERS], ['schemas', SCHEMAS]]) {
      assert.equal(pkg.publishConfig?.access, 'public', `${label} publishConfig.access`);
    }
  });
});

describe('repo-policy/publish — bin (CLI 진입점)', () => {
  it('agent 의 bin 필드가 token-weather → ./bin/token-weather.js', () => {
    assert.deepEqual(AGENT.bin, { 'token-weather': './bin/token-weather.js' });
  });

  it('bin 파일이 실제로 존재한다', () => {
    assert.equal(repoFileExists('packages/agent/bin/token-weather.js'), true);
  });

  it('bin 파일이 실행권한(user execute bit)을 가진다', () => {
    const stat = fs.statSync(path.join(REPO_ROOT, 'packages/agent/bin/token-weather.js'));
    // user execute bit 0o100 / group/other도 검사하면 0o111 마스크.
    assert.notEqual(stat.mode & 0o111, 0, `bin mode=${stat.mode.toString(8)} (실행 비트 없음)`);
  });

  it('bin 파일의 첫 줄이 #!/usr/bin/env node (shebang)', () => {
    const content = fs.readFileSync(
      path.join(REPO_ROOT, 'packages/agent/bin/token-weather.js'),
      'utf8',
    );
    assert.match(content, /^#!\/usr\/bin\/env node\n/);
  });
});

describe('repo-policy/publish — 워크스페이스 의존성 선언', () => {
  it('agent 가 @token-weather/provider-adapters / @token-weather/schemas 를 dependencies 로 선언', () => {
    assert.ok(AGENT.dependencies, 'agent 의 dependencies 누락');
    assert.equal(typeof AGENT.dependencies['@token-weather/provider-adapters'], 'string');
    assert.equal(typeof AGENT.dependencies['@token-weather/schemas'], 'string');
  });

  it('provider-adapters 가 @token-weather/schemas 를 dependencies 로 선언', () => {
    assert.ok(ADAPTERS.dependencies, 'adapters 의 dependencies 누락');
    assert.equal(typeof ADAPTERS.dependencies['@token-weather/schemas'], 'string');
  });

  it('schemas 는 다른 워크스페이스 패키지를 의존하지 않는다 (의존 그래프 leaf)', () => {
    const deps = SCHEMAS.dependencies ?? {};
    for (const dep of Object.keys(deps)) {
      assert.equal(
        dep.startsWith('@token-weather/'),
        false,
        `schemas 가 ${dep} 를 의존 — 그래프 leaf 위반`,
      );
    }
  });
});

describe('repo-policy/publish — files 화이트리스트', () => {
  it('agent files 가 bin + src 포함', () => {
    assert.ok(AGENT.files);
    assert.ok(AGENT.files.includes('bin'));
    assert.ok(AGENT.files.includes('src'));
  });

  it('provider-adapters files 가 src 포함', () => {
    assert.ok(ADAPTERS.files);
    assert.ok(ADAPTERS.files.includes('src'));
  });

  it('schemas files 가 src + 두 schema JSON 파일 포함 (런타임 read 의존)', () => {
    // packages/schemas/src/validate.js 가 ../usage-{snapshot,event}.schema.json 을 read.
    // 파일이 publish tarball에 포함되지 않으면 사용자 환경에서 ENOENT.
    assert.ok(SCHEMAS.files);
    assert.ok(SCHEMAS.files.includes('src'), 'src 누락');
    assert.ok(
      SCHEMAS.files.includes('usage-snapshot.schema.json'),
      'usage-snapshot.schema.json 누락 (publish 후 ENOENT)',
    );
    assert.ok(
      SCHEMAS.files.includes('usage-event.schema.json'),
      'usage-event.schema.json 누락 (publish 후 ENOENT)',
    );
  });
});

describe('repo-policy/publish — engines / repository / homepage', () => {
  it('agent engines.node 가 선언됨', () => {
    assert.ok(AGENT.engines?.node, 'engines.node 누락');
  });

  it('3개 패키지 모두 repository.directory 가 모노레포 위치를 가리킴', () => {
    const expectations = [
      { label: 'agent', pkg: AGENT, dir: 'packages/agent' },
      { label: 'provider-adapters', pkg: ADAPTERS, dir: 'packages/provider-adapters' },
      { label: 'schemas', pkg: SCHEMAS, dir: 'packages/schemas' },
    ];
    for (const { label, pkg, dir } of expectations) {
      assert.equal(pkg.repository?.directory, dir, `${label} repository.directory`);
    }
  });

  it('3개 패키지 모두 homepage / bugs.url 선언', () => {
    for (const [label, pkg] of [['agent', AGENT], ['provider-adapters', ADAPTERS], ['schemas', SCHEMAS]]) {
      assert.ok(pkg.homepage, `${label} homepage 누락`);
      assert.ok(pkg.bugs?.url, `${label} bugs.url 누락`);
    }
  });
});
