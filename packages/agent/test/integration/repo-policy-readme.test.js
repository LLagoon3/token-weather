/**
 * Repo-level README 회귀 가드.
 *
 * README가 npm landing page / GitHub 첫 화면에서 사용자 온보딩 첫 1.5 화면
 * 안에 install + first-run + 핵심 가치를 보여주도록 정비된 상태가
 * 우발적으로 깨지는 회귀를 막는다.
 *
 * `repo-policy.test.js`(보안/템플릿), `repo-policy-license.test.js`(라이선스),
 * `repo-policy-publish.test.js`(publish 메타)와 도메인이 달라 별도 파일로 분리.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const README = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
const README_LINES = README.split('\n');

describe('repo-policy/readme — 사용자 온보딩 헤더 (PR #72)', () => {
  it('첫 줄이 # Token Weather 헤더', () => {
    assert.equal(README_LINES[0], '# Token Weather');
  });

  it('상단 10줄 안에 license / npm / CI / Node 4개 배지가 모두 존재', () => {
    const top = README_LINES.slice(0, 10).join('\n');
    assert.match(top, /license/i);
    assert.match(top, /npm/i);
    assert.match(top, /ci|workflows/i);
    assert.match(top, /node/i);
    assert.match(top, /img\.shields\.io|github\.com\/.+\/actions/);
  });

  it('상단 15줄 안에 영문 한 줄 설명 (Local CLI / OAuth / AI)', () => {
    const top = README_LINES.slice(0, 15).join('\n');
    assert.match(top, /Local CLI/);
    assert.match(top, /OAuth|usage|credentials/i);
  });
});

describe('repo-policy/readme — Install + first-run', () => {
  it('Install 섹션이 첫 50줄 안에 등장', () => {
    const top = README_LINES.slice(0, 50).join('\n');
    assert.match(top, /^## Install/m);
  });

  it('Install 섹션에 npx @token-weather/cli 명령 포함', () => {
    assert.match(README, /npx @token-weather\/cli/);
  });

  it('Install 섹션에 npm install -g @token-weather/cli 명령 포함', () => {
    assert.match(README, /npm install -g @token-weather\/cli/);
  });

  it('첫 50줄 안에 first-run 명령(token-weather config init / status)이 등장', () => {
    const top = README_LINES.slice(0, 50).join('\n');
    assert.match(top, /token-weather config init/);
    assert.match(top, /token-weather status/);
  });
});

describe('repo-policy/readme — 핵심 섹션 존재 (issue #154: 영어 default 정합)', () => {
  // README.md = 영어 default (Phase 2-1 부터). 한글 원본은 README.ko.md.
  // 본 회귀 가드는 default (영어) README 의 핵심 섹션 헤더만 검증.
  const REQUIRED_SECTIONS = [
    /^# Token Weather/m,
    /^## Install/m,
    /^## What & Why/m,
    /^## Supported providers/m,
    /^## Commands/m,
    /^## JSON output/m,
    /^## Security/m,
    /^## License/m,
    /^## Contributing/m,
  ];

  for (const section of REQUIRED_SECTIONS) {
    it(`${section} 섹션이 존재한다`, () => {
      assert.match(README, section);
    });
  }
});

describe('repo-policy/readme — 외부 문서 링크', () => {
  const REQUIRED_LINKS = [
    'LICENSE',
    'SECURITY.md',
    'CODE_OF_CONDUCT.md',
    'CONTRIBUTING.md',
    'docs/cli-json-output.md',
    'docs/auth-architecture.md',
    'docs/codebase-guide.md',
  ];

  for (const link of REQUIRED_LINKS) {
    it(`README가 ${link}로 가는 링크를 포함한다`, () => {
      const escaped = link.replace(/\./g, '\\.').replace(/\//g, '\\/');
      const re = new RegExp(`\\((?:\\.\\/)?${escaped}\\)`);
      assert.match(README, re);
    });
  }
});

describe('repo-policy/readme — placeholder / 구버전 명령 부재', () => {
  it('"추후 결정" 같은 placeholder 문구가 남아있지 않다', () => {
    assert.equal(README.includes('추후 결정'), false);
  });

  it('npm run agent:* 구버전 모노레포 스크립트가 README 본문에 없다', () => {
    // package.json은 cli:* 로 이미 변경됨. README에 사용자 안내로 남으면 안 됨.
    assert.equal(README.includes('npm run agent:'), false);
  });

  it('"## 다음 작업 후보" 섹션이 부재 (Issues 트래커가 진실의 원천)', () => {
    assert.equal(/^## 다음 작업 후보/m.test(README), false);
  });

  it('CLI 옵션 상세를 readme에 늘어놓지 않는다 (--help 위임)', () => {
    // refresh-live, --port, --timeout 같은 옵션이 코드 블록을 차지하면
    // <command> --help 안내와 중복 유지 비용 발생. 본문에 0~2회 등장 정도가 한계.
    const refreshLiveCount = (README.match(/--refresh-live/g) ?? []).length;
    assert.ok(
      refreshLiveCount <= 2,
      `--refresh-live 가 ${refreshLiveCount}회 등장 (CLI 옵션 상세 노출 의심 — --help로 위임할 것)`,
    );
  });
});

describe('repo-policy/readme — v0.2.0 정합 (--mock + --live-exchange 부재)', () => {
  // #97 / v0.2.0 에서 --live-exchange 제거됨. README 에 옛 표현이 다시
  // 들어오면 외부 사용자가 npm 페이지의 README 따라 실행 시 unknown
  // option 으로 막히거나 동작이 v0.1.x 가정과 반대로 나옴.
  it('README 에 --live-exchange 가 등장하지 않는다 (v0.2.0 에서 제거된 flag)', () => {
    assert.equal(README.includes('--live-exchange'), false, 'README 에 --live-exchange 잔재');
  });

  it('README 가 --mock opt-in 안내를 포함한다 (v0.2.0 신규)', () => {
    assert.match(README, /--mock\b/, '--mock 안내 누락');
  });
});

describe('repo-policy/readme — Root CHANGELOG.md 정합', () => {
  const CHANGELOG = fs.readFileSync(path.join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');

  // release-policy.md §4 의 'root CHANGELOG 수동 큐레이트' 정책 정합 —
  // publish 후 v0.x.x entry 가 누락되는 회귀 차단.
  it('CHANGELOG 에 [0.2.0] heading 이 존재', () => {
    assert.match(CHANGELOG, /^## \[0\.2\.0\]/m);
  });

  it('CHANGELOG 에 [0.1.0] heading 이 존재 (역사 기록)', () => {
    assert.match(CHANGELOG, /^## \[0\.1\.0\]/m);
  });
});
