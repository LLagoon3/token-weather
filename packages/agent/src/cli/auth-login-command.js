import { prepareLocalhostCallback, startLocalhostCallbackServer } from '../auth/localhost-callback.js';
import { readManualPasteInput, extractCodeFromPaste } from '../auth/manual-paste.js';
import { createMockCodexAccountFromManualInput } from '../auth/mock-auth-exchange.js';
import { loadAuthStore, saveAuthStore, upsertProviderAccount } from '../auth/auth-store.js';
import { createAccount } from '../auth/auth-store-schema.js';
import { extractAccountIdentity } from '../auth/token-claims.js';
import { buildCodexAuthorizationUrl, exchangeCodexAuthorizationCode } from '../../../provider-adapters/src/codex/index.js';
import {
  buildClaudeAuthorizationUrl,
  exchangeClaudeAuthorizationCode,
  CLAUDE_AUTH,
} from '../../../provider-adapters/src/claude/index.js';

export async function runAuthLoginCommand(provider, args = []) {
  if (!provider) {
    console.log('사용법: ai-usage-agent auth login <provider> [--manual] [--no-open] [--port <number>] [--live-exchange]');
    return;
  }

  if (provider === 'codex') {
    await runCodexLogin(args);
    return;
  }

  if (provider === 'claude') {
    await runClaudeLogin(args);
    return;
  }

  console.log(`지원되지 않는 provider: ${provider} (사용 가능: codex, claude)`);
}

async function runCodexLogin(args) {
  const options = parseLoginOptions(args);

  if (options.device) {
    console.log('device code flow는 후순위 항목이라 아직 구현되지 않았어.');
    return;
  }

  if (options.manual) {
    await runManualPasteFlow();
    return;
  }

  const prepared = await prepareLocalhostCallback({ preferredPort: options.port });

  console.log('ai-usage-agent auth login codex');
  console.log('--------------------------------');

  if (!prepared.ready) {
    console.log(prepared.reason);
    if (prepared.fallbackExhausted) {
      console.log('');
      console.log('모든 포트 후보가 사용 중이어서 localhost callback을 시작할 수 없습니다.');
      console.log('manual paste 모드로 다시 실행해 주세요:');
      console.log('');
      console.log('  ai-usage-agent auth login codex --manual');
    }
    return;
  }

  const { port, callbackUrl, state, codeChallenge, codeChallengeMethod } = prepared.params;
  const authorizationUrl = buildCodexAuthorizationUrl({
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
  console.log('- authorize → callback 경로는 동작 검증됨.');
  console.log('- 기본 경로는 token exchange를 수행하지 않고 mock 저장으로 끝남.');
  console.log('- 실제 token exchange가 필요하면 --live-exchange 옵션을 사용.');
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
      timeoutMs: 120_000,
    });
    console.log('');
    console.log(`code 수신 완료: ${result.code}`);

    if (options.liveExchange) {
      await runLiveExchange({
        code: result.code,
        callbackUrl,
        codeVerifier: prepared.params.codeVerifier,
      });
    } else {
      await saveMockAccountFromCallback(result.code);
    }
  } catch (err) {
    console.log('');
    console.log(`콜백 수신 실패: ${err.message}`);
  }
}

async function runManualPasteFlow() {
  console.log('ai-usage-agent auth login codex --manual');
  console.log('-----------------------------------------');
  console.log('주의: manual 경로는 token exchange 없이 mock 저장만 수행해.');

  const pasteResult = await readManualPasteInput();
  const extracted = extractCodeFromPaste(pasteResult);

  if (extracted.error || !extracted.code) {
    console.log(`입력 처리 실패: ${extracted.error ?? 'unknown-error'}`);
    return;
  }

  const account = createMockCodexAccountFromManualInput({
    code: extracted.code,
    rawInput: pasteResult.value,
  });

  const store = await loadAuthStore();
  const nextStore = upsertProviderAccount(store, 'openai-codex', account);
  await saveAuthStore(nextStore);

  console.log('placeholder/mock 계정을 auth store에 저장했어.');
  console.log(`저장 accountKey: ${account.accountKey}`);
  console.log('이 저장 결과는 실제 OAuth 인증이 아니라 이후 흐름 연결을 위한 임시 구현이야.');
}

async function runLiveExchange({ code, callbackUrl, codeVerifier }) {
  console.log('');
  console.log('⚠ --live-exchange 모드: 실제 token endpoint에 POST를 시도합니다.');
  console.log('  주의사항:');
  console.log('  - PKCE code_challenge는 S256으로 생성됩니다.');
  console.log('  - client_id는 관찰된 값(observed)이며 OpenAI 공식 확정이 아닙니다.');
  console.log('  - 성공이 보장되지 않습니다.');
  console.log('');

  try {
    const tokenResponse = await exchangeCodexAuthorizationCode({
      code,
      callbackUrl,
      codeVerifier,
      allowLiveExchange: true,
    });

    console.log('token exchange 성공!');
    console.log(`  token_type: ${tokenResponse.tokenType}`);
    console.log(`  expires_in: ${tokenResponse.expiresIn}`);
    console.log(`  scope: ${tokenResponse.scope ?? '(없음)'}`);

    // --- account identity: claims 기반 추출 (fallback: code prefix) ---
    const identity = extractAccountIdentity({
      idToken: tokenResponse.idToken,
      accessToken: tokenResponse.accessToken,
      fallbackCode: code,
    });

    console.log(`  identity source: ${identity.claimSource}`);

    const now = new Date();
    const expiresAt = tokenResponse.expiresIn
      ? new Date(now.getTime() + tokenResponse.expiresIn * 1000).toISOString()
      : null;

    // accountKey: accountId(sub claim)를 우선 사용하여 email 변경에도 안정적인 키를 생성.
    // accountId가 없으면 email fallback.
    const accountKeySource = identity.accountId ?? identity.email;
    const account = createAccount({
      accountKey: `openai-codex:${accountKeySource}`,
      email: identity.email,
      displayName: identity.displayName,
      accountId: identity.accountId,
      authType: 'oauth',
      source: 'agent-store',
      tokens: {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken ?? null,
      },
      raw: {
        provider: 'openai-codex',
        mock: false,
        liveExchange: true,
        tokenType: tokenResponse.tokenType,
        scope: tokenResponse.scope ?? null,
        idToken: tokenResponse.idToken ?? null,
        exchangedAt: now.toISOString(),
        identityClaimSource: identity.claimSource,
        note: 'live token exchange 결과 — observed client_id + S256 PKCE 기반',
      },
    });
    account.expiresAt = expiresAt;

    const store = await loadAuthStore();
    const nextStore = upsertProviderAccount(store, 'openai-codex', account);
    await saveAuthStore(nextStore);

    console.log('');
    console.log('실제 토큰을 auth store에 저장했습니다.');
    console.log(`  accountKey: ${account.accountKey}`);
    if (expiresAt) console.log(`  expiresAt: ${expiresAt}`);
    console.log('');
    console.log('⚠ 이 토큰은 observed client_id 기반이므로');
    console.log('  정상 동작이 확인되기 전까지 실험적으로만 사용하세요.');
  } catch (err) {
    console.log('');
    console.log(`❌ live token exchange 실패: ${err.message}`);
    console.log('');
    console.log('mock fallback을 수행하지 않습니다.');
    console.log('기본 mock 저장을 원하면 --live-exchange 없이 다시 실행하세요.');
  }
}

async function saveMockAccountFromCallback(code) {
  const account = createMockCodexAccountFromManualInput({
    code,
    rawInput: `localhost-callback:${code}`,
  });

  const store = await loadAuthStore();
  const nextStore = upsertProviderAccount(store, 'openai-codex', account);
  await saveAuthStore(nextStore);

  console.log('placeholder/mock 계정을 auth store에 저장했어.');
  console.log(`저장 accountKey: ${account.accountKey}`);
  console.log('기본 경로는 token exchange 없이 mock 저장만 수행. 실제 exchange는 --live-exchange 사용.');
}

function parseLoginOptions(args) {
  const options = {
    noOpen: false,
    manual: false,
    device: false,
    liveExchange: false,
    port: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--no-open') options.noOpen = true;
    if (arg === '--manual') options.manual = true;
    if (arg === '--device') options.device = true;
    if (arg === '--live-exchange') options.liveExchange = true;
    if (arg === '--port') {
      const value = args[index + 1];
      if (value) {
        options.port = Number(value);
        index += 1;
      }
    }
  }

  return options;
}

// ─── Claude login flow ───────────────────────────────────────────────────────

const CLAUDE_CALLBACK_PATH = '/callback';

async function runClaudeLogin(args) {
  const options = parseLoginOptions(args);

  if (options.device) {
    console.log('device code flow는 후순위 항목이라 아직 구현되지 않았어.');
    return;
  }

  if (options.manual) {
    console.log('claude manual paste 경로는 아직 제공하지 않습니다.');
    console.log('대신 로컬 callback 경로를 사용하세요: ai-usage-agent auth login claude');
    return;
  }

  const prepared = await prepareLocalhostCallback({
    preferredPort: options.port,
    callbackPath: CLAUDE_CALLBACK_PATH,
  });

  console.log('ai-usage-agent auth login claude');
  console.log('---------------------------------');

  if (!prepared.ready) {
    console.log(prepared.reason);
    return;
  }

  const { port, callbackUrl, state, codeChallenge, codeChallengeMethod, codeVerifier } =
    prepared.params;
  const authorizationUrl = buildClaudeAuthorizationUrl({
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
  console.log('- client_id는 Claude Code 바이너리 관찰값입니다 (공식 확정 아님).');
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
      timeoutMs: 120_000,
      callbackPath: CLAUDE_CALLBACK_PATH,
    });
    console.log('');
    console.log(`code 수신 완료: ${result.code}`);

    if (options.liveExchange) {
      await runClaudeLiveExchange({ code: result.code, callbackUrl, codeVerifier });
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

async function runClaudeLiveExchange({ code, callbackUrl, codeVerifier }) {
  console.log('');
  console.log('⚠ --live-exchange 모드: Claude token endpoint에 POST를 시도합니다.');
  console.log(`  endpoint: ${CLAUDE_AUTH.tokenEndpoint}`);
  console.log('');

  try {
    const tokenResponse = await exchangeClaudeAuthorizationCode({
      code,
      callbackUrl,
      codeVerifier,
      allowLiveExchange: true,
    });

    console.log('token exchange 성공!');
    console.log(`  token_type: ${tokenResponse.tokenType}`);
    console.log(`  expires_in: ${tokenResponse.expiresIn}`);
    console.log(`  scope: ${tokenResponse.scope ?? '(없음)'}`);

    const identity = extractAccountIdentity({
      idToken: tokenResponse.idToken,
      accessToken: tokenResponse.accessToken,
      fallbackCode: code,
    });

    console.log(`  identity source: ${identity.claimSource}`);

    const now = new Date();
    const expiresAt = tokenResponse.expiresIn
      ? new Date(now.getTime() + tokenResponse.expiresIn * 1000).toISOString()
      : null;

    const accountKeySource = identity.accountId ?? identity.email ?? 'live';
    const account = createAccount({
      accountKey: `${CLAUDE_AUTH.provider}:${accountKeySource}`,
      email: identity.email,
      displayName: identity.displayName,
      accountId: identity.accountId,
      authType: 'oauth',
      source: 'agent-store',
      tokens: {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken ?? null,
      },
      raw: {
        provider: CLAUDE_AUTH.provider,
        mock: false,
        liveExchange: true,
        tokenType: tokenResponse.tokenType,
        scope: tokenResponse.scope ?? null,
        idToken: tokenResponse.idToken ?? null,
        exchangedAt: now.toISOString(),
        identityClaimSource: identity.claimSource,
        note: 'live token exchange — observed client_id + S256 PKCE',
      },
    });
    account.expiresAt = expiresAt;

    const store = await loadAuthStore();
    const nextStore = upsertProviderAccount(store, CLAUDE_AUTH.provider, account);
    await saveAuthStore(nextStore);

    console.log('');
    console.log('실제 토큰을 auth store에 저장했습니다.');
    console.log(`  accountKey: ${account.accountKey}`);
    if (expiresAt) console.log(`  expiresAt: ${expiresAt}`);
    console.log('');
    console.log('⚠ client_id / scope는 observed 값이므로 검증 전까지 실험적으로만 사용하세요.');
  } catch (err) {
    console.log('');
    console.log(`❌ live token exchange 실패: ${err.message}`);
    console.log('토큰을 저장하지 않습니다.');
  }
}
