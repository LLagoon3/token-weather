/**
 * Repo-level 정책 회귀 가드.
 *
 * 보안/템플릿/라이선스/publish 메타데이터 같은 repo 차원의 contract가 우발적으로
 * 깨지는 것을 막기 위한 파일시스템 단위 검증. 이 파일은 worker 패키지 코드를
 * 임포트하지 않고, 순수하게 repo root에서 파일/문자열을 읽어 검증한다.
 *
 * 추가/변경 시 docs/codebase-guide.md / SECURITY.md / docs/cli-json-output.md 등의
 * 정책과 함께 갱신할 것.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
// packages/agent/test/integration/ 에서 repo root까지 4단계 상위.
const REPO_ROOT = path.resolve(__dirname, '../../../..');

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function repoFileExists(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

describe('repo-policy — security/templates 메타 파일 (PR #78)', () => {
  it('SECURITY.md 가 repo 루트에 존재한다', () => {
    assert.equal(repoFileExists('SECURITY.md'), true);
  });

  it('CODE_OF_CONDUCT.md 가 repo 루트에 존재한다', () => {
    assert.equal(repoFileExists('CODE_OF_CONDUCT.md'), true);
  });

  it('SECURITY.md 가 GitHub Security Advisory URL을 포함한다', () => {
    const body = readRepoFile('SECURITY.md');
    assert.match(body, /security\/advisories\/new/);
  });

  it('bug_report 템플릿이 토큰 redaction 안내를 포함한다', () => {
    const body = readRepoFile('.github/ISSUE_TEMPLATE/bug_report.md');
    // "민감값" / "redact" 둘 중 하나는 반드시 노출되어야 한다.
    assert.match(body, /민감값|redact/);
  });

  it('PR 템플릿이 토큰 redaction 체크리스트를 포함한다', () => {
    const body = readRepoFile('.github/pull_request_template.md');
    assert.match(body, /민감값|redact/);
  });

  it('README 가 보안 신고 섹션 + SECURITY.md 링크를 포함한다 (issue #154: 영어 default)', () => {
    const body = readRepoFile('README.md');
    // README.md = 영어 default (Phase 2-1 부터). README.ko.md 는 한글 원본.
    assert.match(body, /## Security reporting/);
    assert.match(body, /SECURITY\.md/);
  });

  it('CONTRIBUTING 이 행동 강령 / 보안 단락을 포함한다', () => {
    const body = readRepoFile('CONTRIBUTING.md');
    assert.match(body, /행동 강령|Code of Conduct/);
    assert.match(body, /SECURITY\.md/);
  });
});
