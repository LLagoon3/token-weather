/**
 * Localhost callback preparation for OAuth login flow.
 *
 * This module provides the scaffolding for:
 * - Callback URL construction
 * - PKCE code_verifier / code_challenge placeholders
 * - OAuth state parameter generation
 * - Callback server lifecycle (not yet wired to real token exchange)
 */

import { randomBytes } from 'node:crypto';
import { resolveCallbackPort } from './port-fallback.js';

/**
 * Generate a random URL-safe string for OAuth state parameter.
 */
export function generateState(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

/**
 * PKCE placeholder — generates code_verifier and code_challenge.
 *
 * TODO(phase-next): implement proper S256 challenge derivation.
 * Currently returns raw verifier as challenge (plain method placeholder).
 */
export function generatePkce(bytes = 32) {
  const codeVerifier = randomBytes(bytes).toString('base64url');
  return {
    codeVerifier,
    codeChallenge: codeVerifier,       // placeholder — replace with S256 hash
    codeChallengeMethod: 'plain',      // placeholder — should become 'S256'
  };
}

/**
 * Build the localhost callback URL for a given port.
 */
export function buildCallbackUrl(port) {
  return `http://127.0.0.1:${port}/callback`;
}

/**
 * Prepare everything needed before starting the OAuth browser flow.
 *
 * @param {object} options
 * @param {number|null} options.preferredPort - --port flag value (null = auto)
 * @returns {Promise<{ ready: boolean, params: object|null, reason: string|null }>}
 */
export async function prepareLocalhostCallback({ preferredPort = null } = {}) {
  const { port, fallbackExhausted } = await resolveCallbackPort({ preferredPort });

  if (port == null) {
    const reason = preferredPort != null
      ? `지정된 포트 ${preferredPort}을(를) 사용할 수 없습니다.`
      : '사용 가능한 콜백 포트를 찾지 못했습니다. manual paste 모드로 전환합니다.';
    return { ready: false, params: null, reason, fallbackExhausted };
  }

  const state = generateState();
  const pkce = generatePkce();
  const callbackUrl = buildCallbackUrl(port);

  return {
    ready: true,
    params: { port, callbackUrl, state, ...pkce },
    reason: null,
    fallbackExhausted: false,
  };
}
