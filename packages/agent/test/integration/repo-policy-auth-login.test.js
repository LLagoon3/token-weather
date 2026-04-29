/**
 * Repo-level auth login 일관성 정책 회귀 가드.
 *
 * #97 의 default 뒤집기 + Codex/Claude 일관성 정렬이 우발적으로 회귀하는
 * 케이스를 막는 파일시스템 단위 검증.
 *
 * 도메인이 다른 repo-policy-{license, publish, readme, types, release,
 * install-smoke, lint}.test.js 와 분리.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

function readText(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

const AUTH_LOGIN = readText('packages/agent/src/cli/auth-login-command.js');
const LOGIN_RUNNER = readText('packages/agent/src/cli/login-runner.js');

describe('repo-policy/auth-login — flag 표면 (#97)', () => {
  it('--live-exchange flag 가 LOGIN_FLAGS / help 어디에도 없다', () => {
    assert.equal(/--live-exchange/.test(LOGIN_RUNNER), false, 'login-runner.js 에 잔존');
    assert.equal(/--live-exchange/.test(AUTH_LOGIN), false, 'auth-login-command.js 에 잔존');
  });

  it('--mock flag 가 LOGIN_FLAGS 에 정의되어 있다', () => {
    assert.match(LOGIN_RUNNER, /'--mock':\s*\{\s*key:\s*'mock'/);
  });

  it('LOGIN_DEFAULTS 에 mock: false 가 default', () => {
    assert.match(LOGIN_RUNNER, /mock:\s*false/);
    assert.equal(/liveExchange:\s*false/.test(LOGIN_RUNNER), false, 'liveExchange default 잔존');
  });

  it('help 에 --mock 안내 + 기본 동작 한 줄', () => {
    assert.match(AUTH_LOGIN, /--mock\b/);
    assert.match(AUTH_LOGIN, /기본 경로는 실제 OAuth/);
  });
});

describe('repo-policy/auth-login — Codex/Claude 일관성 (#97)', () => {
  it('runCodexManualPasteFlow 함수가 더 이상 정의되지 않는다', () => {
    assert.equal(/runCodexManualPasteFlow/.test(AUTH_LOGIN), false);
  });

  it('Codex/Claude 모두 supportsMockCallback: true', () => {
    // 두 spec 이 같은 동작 표면을 갖도록.
    const matches = AUTH_LOGIN.match(/supportsMockCallback:\s*true/g) ?? [];
    assert.ok(
      matches.length >= 2,
      `supportsMockCallback: true 가 2 회 이상 (양 spec) 발견되어야 — 발견: ${matches.length}`,
    );
    assert.equal(/supportsMockCallback:\s*false/.test(AUTH_LOGIN), false, 'false 잔재 없음');
  });

  it('두 spec 모두 saveMockAccount 가 정의된다', () => {
    // 'saveMockAccount: ' 패턴이 양 spec 에서 등장 (공통 helper 위임).
    const matches = AUTH_LOGIN.match(/saveMockAccount:\s*\(/g) ?? [];
    assert.ok(
      matches.length >= 2,
      `saveMockAccount 가 양 spec 에 정의되어야 — 발견: ${matches.length}`,
    );
  });
});

describe('repo-policy/auth-login — --mock fail-closed 계약 (#97)', () => {
  // mock=true 인데 spec 미지원이면 실제 OAuth 로 fall-through 하지 않고
  // 안내 후 종료해야 한다 — 사용자의 --mock 의도 ("실제 endpoint hit 회피") 보호.
  it('login-runner 가 --mock 미지원 시 안내 메시지 + 종료 코드 패턴을 갖는다', () => {
    // 두 함수(runOAuthLoginFlow / runManualPasteFlow) 모두 if (options.mock) 또는
    // if (mock) 블록 안에서 supportsMockCallback 검증 후 안내 메시지 출력 + return
    // 패턴이어야 한다.
    assert.match(
      LOGIN_RUNNER,
      /는 --mock 을 지원하지 않습니다/,
      '--mock 미지원 안내 메시지 부재 — fail-closed 계약 회귀',
    );
  });
});

describe('repo-policy/auth-login — 가드 제거 (#97)', () => {
  it('login-runner.js 에 allowLiveExchange 인자 잔존 없음', () => {
    assert.equal(/allowLiveExchange/.test(LOGIN_RUNNER), false);
  });

  it('auth-login-command.js 에 allowLiveExchange 인자 잔존 없음', () => {
    assert.equal(/allowLiveExchange/.test(AUTH_LOGIN), false);
  });

  it('provider-adapters 의 exchange/refresh 함수에 allowLiveExchange 잔존 없음', () => {
    const FILES = [
      'packages/provider-adapters/src/codex/exchange-codex-authorization-code.js',
      'packages/provider-adapters/src/claude/exchange-claude-authorization-code.js',
      'packages/provider-adapters/src/claude/refresh-claude-token.js',
    ];
    for (const f of FILES) {
      const text = readText(f);
      assert.equal(/allowLiveExchange/.test(text), false, `${f} 에 잔존`);
    }
  });

  it('liveExchangeDisabledError export 가 shared/index.js 에 없음', () => {
    const sharedIndex = readText('packages/provider-adapters/src/shared/index.js');
    assert.equal(/liveExchangeDisabledError/.test(sharedIndex), false);
  });
});
