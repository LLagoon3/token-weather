import { readManualPasteInput, extractCodeFromPaste } from '../auth/manual-paste.js';
import { createMockCodexAccountFromManualInput } from '../auth/mock-auth-exchange.js';
import { loadAuthStore, saveAuthStore, upsertProviderAccount } from '../auth/auth-store.js';
import {
  buildCodexAuthorizationUrl,
  exchangeCodexAuthorizationCode,
} from '../../../provider-adapters/src/codex/index.js';
import {
  buildClaudeAuthorizationUrl,
  exchangeClaudeAuthorizationCode,
  CLAUDE_AUTH,
} from '../../../provider-adapters/src/claude/index.js';
import { runOAuthLoginFlow, parseLoginOptions } from './login-runner.js';

const CODEX_STORE_KEY = 'openai-codex';

/**
 * Entry point: dispatch `auth login <provider>` to the provider branch.
 */
export async function runAuthLoginCommand(provider, args = []) {
  if (!provider) {
    console.log(
      '사용법: ai-usage-agent auth login <provider> [--manual] [--no-open] [--port <number>] [--timeout <seconds>] [--live-exchange]',
    );
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

// ─── Codex ──────────────────────────────────────────────────────────────────

async function runCodexLogin(args) {
  const options = parseLoginOptions(args);

  if (options.device) {
    console.log('device code flow는 후순위 항목이라 아직 구현되지 않았어.');
    return;
  }

  if (options.manual) {
    await runCodexManualPasteFlow();
    return;
  }

  await runOAuthLoginFlow(CODEX_LOGIN_SPEC, options);
}

const CODEX_LOGIN_SPEC = {
  id: 'codex',
  displayName: 'Codex',
  storeKey: CODEX_STORE_KEY,
  accountKeyPrefix: 'openai-codex',
  callbackPath: '/auth/callback',
  providerLabel: 'Codex',
  fallbackEmailDomain: 'codex.openai.com',
  note: 'authorize → callback 경로는 OpenClaw 관찰 기준으로 동작 검증됨.',
  liveExchangeWarning: 'client_id는 관찰된 값(observed)이며 OpenAI 공식 확정이 아닙니다.',
  buildAuthorizationUrl: buildCodexAuthorizationUrl,
  exchangeCode: ({ code, callbackUrl, codeVerifier }) =>
    exchangeCodexAuthorizationCode({
      code,
      callbackUrl,
      codeVerifier,
      allowLiveExchange: true,
    }),
  supportsMockCallback: true,
  saveMockAccount: async ({ code }) => {
    const account = createMockCodexAccountFromManualInput({
      code,
      rawInput: `localhost-callback:${code}`,
    });
    const store = await loadAuthStore();
    const nextStore = upsertProviderAccount(store, CODEX_STORE_KEY, account);
    await saveAuthStore(nextStore);

    console.log('mock 계정을 auth store에 저장했어.');
    console.log(`저장 accountKey: ${account.accountKey}`);
    console.log(
      '기본 경로는 token exchange 없이 mock 저장만 수행. 실제 exchange는 --live-exchange 사용.',
    );
  },
};

async function runCodexManualPasteFlow() {
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
  const nextStore = upsertProviderAccount(store, CODEX_STORE_KEY, account);
  await saveAuthStore(nextStore);

  console.log('mock 계정을 auth store에 저장했어.');
  console.log(`저장 accountKey: ${account.accountKey}`);
  console.log('이 저장 결과는 실제 OAuth 인증이 아니라 이후 흐름 연결을 위한 임시 구현이야.');
}

// ─── Claude ─────────────────────────────────────────────────────────────────

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

  await runOAuthLoginFlow(CLAUDE_LOGIN_SPEC, options);
}

const CLAUDE_LOGIN_SPEC = {
  id: 'claude',
  displayName: 'Claude',
  storeKey: CLAUDE_AUTH.storeProvider,
  accountKeyPrefix: CLAUDE_AUTH.provider,
  callbackPath: '/callback',
  providerLabel: 'Claude',
  fallbackEmailDomain: 'claude.com',
  note: 'client_id는 Claude Code 바이너리 관찰값입니다 (공식 확정 아님).',
  endpointDescription: `endpoint: ${CLAUDE_AUTH.tokenEndpoint}`,
  buildAuthorizationUrl: buildClaudeAuthorizationUrl,
  exchangeCode: ({ code, callbackUrl, codeVerifier, state }) =>
    exchangeClaudeAuthorizationCode({
      code,
      callbackUrl,
      codeVerifier,
      state,
      allowLiveExchange: true,
    }),
  supportsMockCallback: false,
};
