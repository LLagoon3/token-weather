import {
  prepareLocalhostCallback,
  startLocalhostCallbackServer,
} from '../auth/localhost-callback.js';
import {
  loadAuthStore,
  saveAuthStore,
  upsertProviderAccount,
  removeProviderAccount,
} from '../auth/auth-store.js';
import { createAccount } from '../auth/auth-store-schema.js';
import { extractAccountIdentity } from '../auth/token-claims.js';
import { findLegacyDuplicates } from '../auth/find-legacy-duplicates.js';
import { fetchClaudeOauthProfile } from '../../../provider-adapters/src/claude/fetch-claude-oauth-profile.js';
import { parseCliOptions } from './parse-options.js';

/**
 * Provider spec shape used by runOAuthLoginFlow.
 *
 * @typedef {object} LoginProviderSpec
 * @property {string} id                   - e.g. 'codex', 'claude'
 * @property {string} displayName          - 섹션 헤더용 (e.g. 'Codex', 'Claude')
 * @property {string} storeKey             - auth.json의 providers 키 (e.g. 'openai-codex', 'claude')
 * @property {string} accountKeyPrefix     - account key prefix (e.g. 'openai-codex', 'anthropic-claude')
 * @property {string} callbackPath         - localhost callback 경로 (e.g. '/auth/callback', '/callback')
 * @property {string} providerLabel        - 브라우저 콜백 응답에 표시할 라벨
 * @property {string} [endpointDescription] - live-exchange 안내 문구용 (e.g. 'Claude token endpoint')
 * @property {string} [fallbackEmailDomain]  - id_token이 없거나 email/preferred_username이 빠졌을 때 fallback에 사용할 도메인
 * @property {(p: { callbackUrl: string, state: string, codeChallenge: string, codeChallengeMethod: string }) => string} buildAuthorizationUrl
 * @property {(p: { code: string, callbackUrl: string, codeVerifier: string, state?: string }) => Promise<object>} exchangeCode
 * @property {boolean} supportsMockCallback - true면 --live-exchange 없이 callback 수신 시 mock 계정 저장
 * @property {(p: { code: string }) => Promise<void>} [saveMockAccount] - supportsMockCallback=true 필요
 * @property {string} [note]               - 안내 블록에 추가 표시할 provider별 주석
 * @property {string} [liveExchangeWarning] - --live-exchange 주의 블록 (provider마다 문구 다름)
 */

/**
 * localhost callback → (optional live exchange) → agent-store 저장까지
 * 공통 흐름을 수행한다.
 *
 * @param {LoginProviderSpec} spec
 * @param {{ port: number|null, timeoutMs: number, liveExchange: boolean, label?: string|null }} options
 */
export async function runOAuthLoginFlow(spec, options) {
  const prepared = await prepareLocalhostCallback({
    preferredPort: options.port,
    callbackPath: spec.callbackPath,
  });

  console.log(`token-weather auth login ${spec.id}`);
  console.log('-'.repeat(`token-weather auth login ${spec.id}`.length));

  if (!prepared.ready) {
    console.log(prepared.reason);
    if (prepared.fallbackExhausted && spec.supportsMockCallback) {
      console.log('');
      console.log('모든 포트 후보가 사용 중이어서 localhost callback을 시작할 수 없습니다.');
      console.log('manual paste 모드로 다시 실행해 주세요:');
      console.log('');
      console.log(`  token-weather auth login ${spec.id} --manual`);
    }
    return;
  }

  const { port, callbackUrl, state, codeChallenge, codeChallengeMethod, codeVerifier } =
    prepared.params;
  const authorizationUrl = spec.buildAuthorizationUrl({
    callbackUrl,
    state,
    codeChallenge,
    codeChallengeMethod,
  });

  console.log(`콜백 URL 준비됨: ${callbackUrl}`);
  console.log(`선택된 포트: ${port}`);
  console.log('OAuth state/PKCE 생성 완료 (S256)');
  console.log('');
  console.log('참고:');
  if (spec.note) console.log(`- ${spec.note}`);
  console.log('- 기본 경로는 --live-exchange 없이 실제 token 저장을 수행하지 않습니다.');
  console.log('- 브라우저 자동 실행은 하지 않습니다.');
  console.log('');
  console.log('브라우저에서 열 URL:');
  console.log(`  ${authorizationUrl}`);
  console.log('');
  console.log('로그인 완료 후 localhost callback 서버가 code/state 수신을 대기 중입니다...');

  try {
    const result = await startLocalhostCallbackServer({
      port,
      expectedState: state,
      timeoutMs: options.timeoutMs,
      callbackPath: spec.callbackPath,
      providerLabel: spec.providerLabel,
    });
    console.log('');
    console.log(`code 수신 완료: ${result.code}`);

    if (options.liveExchange) {
      await runLiveExchangeStep(spec, {
        code: result.code,
        callbackUrl,
        codeVerifier,
        state,
        label: options.label ?? null,
        keepLegacy: options.keepLegacy ?? false,
      });
    } else if (spec.supportsMockCallback && spec.saveMockAccount) {
      await spec.saveMockAccount({ code: result.code });
    } else {
      console.log('');
      console.log('--live-exchange가 없으므로 token 교환을 생략합니다.');
      console.log('실제 토큰 저장이 필요하면 --live-exchange 옵션을 추가해 재실행하세요.');
    }
  } catch (err) {
    console.log('');
    console.log(`콜백 수신 실패: ${err.message}`);
  }
}

async function runLiveExchangeStep(spec, { code, callbackUrl, codeVerifier, state, label, keepLegacy }) {
  console.log('');
  console.log('⚠ --live-exchange 모드: 실제 token endpoint에 POST를 시도합니다.');
  if (spec.endpointDescription) console.log(`  ${spec.endpointDescription}`);
  if (spec.liveExchangeWarning) console.log(`  ${spec.liveExchangeWarning}`);
  console.log('');

  try {
    const tokenResponse = await spec.exchangeCode({
      code,
      callbackUrl,
      codeVerifier,
      state,
    });

    console.log('token exchange 성공!');
    console.log(`  token_type: ${tokenResponse.tokenType}`);
    console.log(`  expires_in: ${tokenResponse.expiresIn}`);
    console.log(`  scope: ${tokenResponse.scope ?? '(없음)'}`);

    const baseIdentity = extractAccountIdentity({
      idToken: tokenResponse.idToken,
      accessToken: tokenResponse.accessToken,
      fallbackCode: code,
      fallbackEmailDomain: spec.fallbackEmailDomain,
    });
    const { identity, profile } = await enrichIdentityFromProviderProfile(spec, tokenResponse, baseIdentity);
    console.log(`  identity source: ${identity.claimSource}`);

    await saveLiveExchangeAccount(spec, tokenResponse, identity, { label, keepLegacy, profile });
  } catch (err) {
    console.log('');
    console.log(`❌ live token exchange 실패: ${err.message}`);
    if (spec.supportsMockCallback) {
      console.log('');
      console.log('mock fallback을 수행하지 않습니다.');
      console.log('기본 mock 저장을 원하면 --live-exchange 없이 다시 실행하세요.');
    } else {
      console.log('토큰을 저장하지 않습니다.');
    }
  }
}

async function saveLiveExchangeAccount(spec, tokenResponse, identity, { label, keepLegacy, profile } = {}) {
  const now = new Date();
  const expiresAt = tokenResponse.expiresIn
    ? new Date(now.getTime() + tokenResponse.expiresIn * 1000).toISOString()
    : null;

  const accountKeySource = identity.accountId ?? identity.email ?? 'live';
  const account = createAccount({
    accountKey: `${spec.accountKeyPrefix}:${accountKeySource}`,
    email: identity.email,
    displayName: identity.displayName,
    accountId: identity.accountId,
    authType: 'oauth',
    source: 'agent-store',
    label: label ?? null,
    tokens: {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken ?? null,
    },
    raw: {
      provider: spec.accountKeyPrefix,
      mock: false,
      liveExchange: true,
      tokenType: tokenResponse.tokenType,
      scope: tokenResponse.scope ?? null,
      idToken: tokenResponse.idToken ?? null,
      exchangedAt: now.toISOString(),
      identityClaimSource: identity.claimSource,
      ...(profile ? {
        profile: {
          account: profile.account,
          organization: profile.organization,
          application: profile.application,
        },
      } : {}),
      note: 'live token exchange 결과 — observed client_id + S256 PKCE 기반',
    },
  });
  account.expiresAt = expiresAt;

  const store = await loadAuthStore();
  const existingAccounts = store.providers?.[spec.storeKey]?.accounts ?? [];
  const duplicates = findLegacyDuplicates(existingAccounts, account);

  let storeAfterCleanup = store;
  if (duplicates.length > 0) {
    if (keepLegacy) {
      console.log('');
      console.log('ℹ 같은 identity(sub/email)로 저장된 legacy accountKey를 감지했지만 --keep-legacy로 유지합니다:');
      for (const dup of duplicates) {
        console.log(`  - ${dup.accountKey} (${dup.reason})`);
      }
    } else {
      console.log('');
      console.log('ℹ 같은 identity(sub/email)로 저장된 legacy accountKey를 감지해 자동 정리합니다:');
      for (const dup of duplicates) {
        console.log(`  - 제거: ${dup.accountKey} (${dup.reason})`);
        storeAfterCleanup = removeProviderAccount(storeAfterCleanup, spec.storeKey, dup.accountKey);
      }
      console.log('  (유지를 원하면 --keep-legacy 옵션 사용)');
    }
  }

  const nextStore = upsertProviderAccount(storeAfterCleanup, spec.storeKey, account);
  await saveAuthStore(nextStore);

  console.log('');
  console.log('실제 토큰을 auth store에 저장했습니다.');
  console.log(`  accountKey: ${account.accountKey}`);
  if (expiresAt) console.log(`  expiresAt: ${expiresAt}`);
  console.log('');
  console.log('⚠ 이 토큰은 observed client_id 기반이므로');
  console.log('  정상 동작이 확인되기 전까지 실험적으로만 사용하세요.');
}

/**
 * 공통 login 옵션 파서.
 *
 * `--port`, `--timeout`(초)은 숫자로 변환하되 유효성을 검증한다.
 *   - `--port`: 0~65535 정수. 범위 밖/NaN이면 경고 push + 해당 필드 유지(기본값 null).
 *   - `--timeout`: 양의 정수(초). NaN/음수/0이면 경고 push + 기본값 유지.
 *
 * 반환값에 `warnings: string[]`이 포함된다. 호출자는 warnings.length > 0이면
 * stderr 등으로 사용자에게 안내 후 조기 리턴하거나 기본값으로 계속 진행할 수 있다.
 *
 * Unknown flag는 조용히 무시한다 (provider별 추가 플래그는 필요시 별도 처리).
 */
export async function enrichIdentityFromProviderProfile(spec, tokenResponse, identity) {
  if (spec.id !== 'claude') {
    return { identity, profile: null };
  }

  try {
    const profile = await fetchClaudeOauthProfile({
      accessToken: tokenResponse.accessToken,
    });

    const enrichedIdentity = {
      email: profile.email ?? identity.email,
      accountId: profile.accountId ?? identity.accountId,
      displayName: profile.displayName ?? identity.displayName,
      claimSource: profile.accountId || profile.email || profile.displayName
        ? 'profile'
        : identity.claimSource,
    };

    return { identity: enrichedIdentity, profile };
  } catch (error) {
    console.log(`  profile enrichment skipped: ${error.message}`);
    return { identity, profile: null };
  }
}

const LOGIN_DEFAULTS = {
  noOpen: false,
  manual: false,
  device: false,
  liveExchange: false,
  port: null,
  timeoutMs: 120_000,
  label: null,
  keepLegacy: false,
};

const LOGIN_FLAGS = {
  '--no-open': { key: 'noOpen', type: 'boolean' },
  '--manual': { key: 'manual', type: 'boolean' },
  '--device': { key: 'device', type: 'boolean' },
  '--live-exchange': { key: 'liveExchange', type: 'boolean' },
  '--keep-legacy': { key: 'keepLegacy', type: 'boolean' },
  '--port': {
    key: 'port',
    type: 'int',
    validate: (n) => n >= 0 && n <= 65535,
    invalidMessage: '--port 값 "${value}"이(가) 유효하지 않습니다. 정수 0~65535 범위로 지정해 주세요.',
  },
  '--timeout': {
    key: 'timeoutMs',
    type: 'int',
    validate: (n) => n > 0,
    transform: (n) => n * 1000,
    invalidMessage: '--timeout 값 "${value}"이(가) 유효하지 않습니다. 양의 정수(초)로 지정해 주세요.',
  },
  '--label': {
    key: 'label',
    type: 'string',
    trim: true,
    emptyMessage: '--label 값이 비어 있습니다.',
  },
};

export function parseLoginOptions(args) {
  return parseCliOptions(args, {
    defaults: LOGIN_DEFAULTS,
    flags: LOGIN_FLAGS,
    collectWarnings: true,
    includeHelp: true,
  });
}
