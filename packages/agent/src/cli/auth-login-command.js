import { prepareLocalhostCallback, startLocalhostCallbackServer } from '../auth/localhost-callback.js';
import { readManualPasteInput, extractCodeFromPaste } from '../auth/manual-paste.js';
import { createMockCodexAccountFromManualInput } from '../auth/mock-auth-exchange.js';
import { loadAuthStore, saveAuthStore, upsertProviderAccount } from '../auth/auth-store.js';
import { createAccount } from '../auth/auth-store-schema.js';
import { buildCodexAuthorizationUrl, exchangeCodexAuthorizationCode } from '../../../provider-adapters/src/codex/index.js';

export async function runAuthLoginCommand(provider, args = []) {
  if (!provider) {
    console.log('사용법: ai-usage-agent auth login <provider> [--manual] [--no-open] [--port <number>] [--live-exchange]');
    return;
  }

  if (provider !== 'codex') {
    console.log(`아직 login은 codex만 골격이 준비되어 있어. 입력된 provider: ${provider}`);
    return;
  }

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
      console.log('다음 단계에서 manual paste fallback으로 이어지도록 연결할 예정이야.');
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
  console.log('OAuth state/PKCE placeholder 생성 완료');
  console.log('');
  console.log('주의: 이 흐름은 placeholder/mock입니다.');
  console.log('- 실제 OAuth token exchange는 수행하지 않습니다.');
  console.log('- 아래 authorization URL은 placeholder client/endpoints 기반 생성 결과일 수 있습니다.');
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
  console.log('주의: 이 흐름은 아직 실제 OAuth token exchange가 아니라 placeholder/mock 저장이야.');

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

    const suffix = code.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8) || 'live';
    const email = `live-${suffix}@codex.openai.com`;
    const now = new Date();
    const expiresAt = tokenResponse.expiresIn
      ? new Date(now.getTime() + tokenResponse.expiresIn * 1000).toISOString()
      : null;

    const account = createAccount({
      accountKey: `openai-codex:${email}`,
      email,
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
  console.log('이 저장 결과는 실제 OAuth 인증이 아니라 placeholder/mock 저장이야.');
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
