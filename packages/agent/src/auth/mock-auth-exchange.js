import { createAccount } from './auth-store-schema.js';

export function createMockCodexAccountFromManualInput({ code, rawInput }) {
  const normalized = sanitizeCode(code);
  const suffix = normalized.slice(0, 8) || 'manual';
  const email = `manual-${suffix}@example.local`;

  return createAccount({
    accountKey: `openai-codex:${email}`,
    email,
    authType: 'oauth',
    source: 'manual',
    tokens: {
      accessToken: `mock-access-token-${suffix}`,
      refreshToken: `mock-refresh-token-${suffix}`,
    },
    raw: {
      provider: 'openai-codex',
      mock: true,
      note: '실제 OAuth token exchange가 아닌 placeholder 저장 결과',
      manualInputPreview: rawInput.slice(0, 120),
    },
  });
}

function sanitizeCode(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase();
}
