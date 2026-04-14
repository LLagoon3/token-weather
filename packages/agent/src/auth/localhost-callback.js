/**
 * Localhost callback preparation for OAuth login flow.
 *
 * This module provides the scaffolding for:
 * - Callback URL construction
 * - PKCE S256 code_verifier / code_challenge generation
 * - OAuth state parameter generation
 * - Localhost callback server that receives code/state from browser redirect
 *
 * NOTE: This is still a placeholder/mock flow — no real token exchange occurs.
 */

import { randomBytes, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolveCallbackPort } from './port-fallback.js';

/**
 * Generate a random URL-safe string for OAuth state parameter.
 */
export function generateState(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

/**
 * PKCE S256 — generates code_verifier and SHA-256 code_challenge.
 */
export function generatePkce(bytes = 32) {
  const codeVerifier = randomBytes(bytes).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}

/**
 * Build the localhost callback URL for a given port.
 * @param {number} port
 * @param {string} [path='/auth/callback'] - Callback path (provider-specific).
 *   Codex는 `/auth/callback`, Claude는 `/callback`을 기본으로 사용한다.
 */
export function buildCallbackUrl(port, path = '/auth/callback') {
  return `http://localhost:${port}${path}`;
}

/**
 * Prepare everything needed before starting the OAuth browser flow.
 *
 * @param {object} options
 * @param {number|null} options.preferredPort - --port flag value (null = auto)
 * @returns {Promise<{ ready: boolean, params: object|null, reason: string|null }>}
 */
export async function prepareLocalhostCallback({
  preferredPort = null,
  callbackPath = '/auth/callback',
} = {}) {
  const { port, fallbackExhausted } = await resolveCallbackPort({ preferredPort });

  if (port == null) {
    const reason = preferredPort != null
      ? `지정된 포트 ${preferredPort}을(를) 사용할 수 없습니다.`
      : '사용 가능한 콜백 포트를 찾지 못했습니다. manual paste 모드로 전환합니다.';
    return { ready: false, params: null, reason, fallbackExhausted };
  }

  const state = generateState();
  const pkce = generatePkce();
  const callbackUrl = buildCallbackUrl(port, callbackPath);

  return {
    ready: true,
    params: { port, callbackUrl, callbackPath, state, ...pkce },
    reason: null,
    fallbackExhausted: false,
  };
}

/**
 * Start a one-shot HTTP server on 127.0.0.1 that waits for an OAuth callback.
 *
 * Resolves with { code, state } on success. Rejects on:
 * - timeout (default 120 000 ms)
 * - missing code query parameter
 * - state mismatch
 *
 * The server closes itself after the first valid or invalid /auth/callback request,
 * or when the timeout fires — whichever comes first.
 *
 * @param {object} options
 * @param {number} options.port
 * @param {string} options.expectedState
 * @param {number} [options.timeoutMs=120000]
 * @returns {Promise<{ code: string, state: string }>}
 */
export function startLocalhostCallbackServer({
  port,
  expectedState,
  timeoutMs = 120_000,
  callbackPath = '/auth/callback',
}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;

    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);

      if (url.pathname !== callbackPath) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code) {
        respond(res, 400, '[placeholder/mock] 오류: code 파라미터가 없습니다.');
        finish(new Error('callback에 code 파라미터가 없습니다.'));
        return;
      }

      if (state !== expectedState) {
        respond(res, 400, '[placeholder/mock] 오류: state 값이 일치하지 않습니다.');
        finish(new Error('state mismatch — CSRF 검증 실패'));
        return;
      }

      respond(res, 200, '[placeholder/mock] code/state 수신 완료. 이 창을 닫아도 됩니다.');
      finish(null, { code, state });
    });

    function respond(res, status, body) {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(body);
    }

    function finish(err, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      if (err) reject(err);
      else resolve(result);
    }

    timer = setTimeout(() => {
      finish(new Error(`localhost callback 서버가 ${timeoutMs}ms 내에 응답을 받지 못해 타임아웃되었습니다.`));
    }, timeoutMs);

    server.listen(port, '127.0.0.1');
  });
}
