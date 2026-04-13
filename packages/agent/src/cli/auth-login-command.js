import { prepareLocalhostCallback, startLocalhostCallbackServer } from '../auth/localhost-callback.js';
import { readManualPasteInput, extractCodeFromPaste } from '../auth/manual-paste.js';
import { createMockCodexAccountFromManualInput } from '../auth/mock-auth-exchange.js';
import { loadAuthStore, saveAuthStore, upsertProviderAccount } from '../auth/auth-store.js';
import { buildCodexAuthorizationUrl } from '../../../provider-adapters/src/codex/index.js';

export async function runAuthLoginCommand(provider, args = []) {
  if (!provider) {
    console.log('사용법: ai-usage-agent auth login <provider> [--manual] [--no-open] [--port <number>]');
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
    await saveMockAccountFromCallback(result.code);
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
    port: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--no-open') options.noOpen = true;
    if (arg === '--manual') options.manual = true;
    if (arg === '--device') options.device = true;
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
