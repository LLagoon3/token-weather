import { createAccount } from './auth-store-schema.js';

/**
 * provider 무관 mock 계정 생성기 (테스트 / `--mock` opt-in 흐름용).
 *
 * @param {{
 *   provider: string,            // 'openai-codex' | 'anthropic-claude' (raw.provider + accountKey prefix)
 *   accountKeyPrefix: string,
 *   code: string,
 *   rawInput: string,
 * }} params
 */
export function createMockAccountFromInput({ provider, accountKeyPrefix, code, rawInput }) {
  const normalized = sanitizeCode(code);
  const suffix = normalized.slice(0, 8) || 'manual';
  const email = `manual-${suffix}@example.local`;

  return createAccount({
    accountKey: `${accountKeyPrefix}:${email}`,
    email,
    authType: 'oauth',
    source: 'manual',
    tokens: {
      accessToken: `mock-access-token-${suffix}`,
      refreshToken: `mock-refresh-token-${suffix}`,
    },
    raw: {
      provider,
      mock: true,
      note: '실제 OAuth token exchange가 아닌 placeholder 저장 결과 (--mock 모드)',
      manualInputPreview: rawInput.slice(0, 120),
    },
  });
}

/**
 * Codex 전용 alias — 호환 유지. 신규 코드는 createMockAccountFromInput 사용.
 */
export function createMockCodexAccountFromManualInput({ code, rawInput }) {
  return createMockAccountFromInput({
    provider: 'openai-codex',
    accountKeyPrefix: 'openai-codex',
    code,
    rawInput,
  });
}

function sanitizeCode(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase();
}
