import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SCHEMA_VERSION } from '../src/index.js';

/**
 * SCHEMA_VERSION 값 lock 회귀 가드.
 *
 * `status --json` 의 `schemaVersion` 필드는 외부 consumer 에 공개된 별도 계약
 * (release-policy §3 + docs/cli-json-output.md). package.json version 과 독립적이고,
 * `status --json` shape 의 키 제거 / 의미 변경 / 재구성 시에만 bump.
 *
 * 본 테스트가 fail 하면 두 가지 중 하나:
 *  (a) 의도된 SCHEMA_VERSION bump — 본 테스트의 assertion 값과 docs 의
 *      "현재 SCHEMA_VERSION" 표기 + release-policy §6 이력을 같이 갱신.
 *  (b) 우발적 변경 — revert.
 *
 * 이 가드 덕에 SCHEMA_VERSION 변경이 항상 의도적 (PR + 문서 동시 갱신) 이 된다.
 *
 * 변경 이력:
 *  - 0.1.0 (초기) — v0.1.0 publish 시점
 *  - 0.2.0 (PR #112, issue #110) — `status --json` 의 `claude.usage` 키 제거
 *  - 0.3.0 (issue #113) — `status --json` 의 `authSource` enum value
 *    'openclaw-import' 제거 + 'codex-cli-import' 추가 +
 *    `codex.authProfilesPath` 필드를 `codex.credentialsPath` 로 변경
 *  - 0.4.0 (issue #119) — `status --json` claude 영역의 backward-compat
 *    alias 3 종 제거: `networkUsage` (단일, → `networkUsages[]` 만) /
 *    `importedAccount` (→ `selectedAccount` 만) / `parsed` (→ `found` 만)
 */
describe('SCHEMA_VERSION lock', () => {
  it('현재 값이 정책과 일치한다', () => {
    assert.equal(
      SCHEMA_VERSION,
      '0.4.0',
      'SCHEMA_VERSION 변경 시 docs/release-policy.md §3 / docs/cli-json-output.md / 본 테스트를 같이 갱신',
    );
  });

  it('string semver 포맷이다 (major.minor.patch)', () => {
    assert.match(SCHEMA_VERSION, /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/);
  });
});
