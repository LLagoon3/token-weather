/**
 * Localhost callback support for OAuth login flow.
 *
 * Codex / Claude 양쪽 auth login 플로우에서 공유하는 헬퍼 모음:
 *   - PKCE S256 code_verifier / code_challenge 생성
 *   - OAuth state 파라미터 생성
 *   - 콜백 URL 조립 (provider별 path 차이를 callbackPath 인자로 흡수)
 *   - 일회용 localhost 콜백 서버 (code/state 수신 + state 검증 + timeout)
 *
 * 실제 token 교환은 호출자가 별도로 수행한다. 본 모듈은 transport 계층만
 * 책임진다.
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
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
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
 * @param {object} [options]
 * @param {number|null} [options.preferredPort=null] - `--port`로 지정된 포트, null이면 기본 포트부터 fallback
 * @param {string} [options.callbackPath='/auth/callback'] - provider별 callback 경로
 * @param {number} [options.defaultPort] - preferredPort가 없을 때 사용할 기본 포트 (미지정 시 port-fallback.js의 DEFAULT_CALLBACK_PORT)
 * @returns {Promise<PreparedCallback>}
 *
 * @typedef {object} PreparedCallback
 * @property {boolean} ready
 * @property {PreparedCallbackParams|null} params  - ready=false면 null
 * @property {string|null} reason                  - ready=false일 때의 사용자용 한글 설명
 * @property {boolean} fallbackExhausted           - 모든 fallback 포트까지 실패한 경우 true
 *
 * @typedef {object} PreparedCallbackParams
 * @property {number} port
 * @property {string} callbackUrl
 * @property {string} callbackPath
 * @property {string} state
 * @property {string} codeVerifier
 * @property {string} codeChallenge
 * @property {'S256'} codeChallengeMethod
 */
export async function prepareLocalhostCallback({
  preferredPort = null,
  callbackPath = '/auth/callback',
  defaultPort,
} = {}) {
  const { port, fallbackExhausted } = await resolveCallbackPort({
    preferredPort,
    defaultPort,
  });

  if (port == null) {
    const reason =
      preferredPort != null
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
 * 서버는 첫 번째 유효/무효 `${callbackPath}` 요청을 처리하거나 타임아웃되면
 * 자동으로 닫힌다. 그 외 경로는 404를 반환한다.
 *
 * @param {object} options
 * @param {number} options.port
 * @param {string} options.expectedState
 * @param {number} [options.timeoutMs=120000]
 * @param {string} [options.callbackPath='/auth/callback']
 * @param {string} [options.providerLabel] - 응답 메시지에 표기할 provider 이름 (예: 'Codex', 'Claude')
 * @returns {Promise<{ code: string, state: string }>}
 */
export function startLocalhostCallbackServer({
  port,
  expectedState,
  timeoutMs = 120_000,
  callbackPath = '/auth/callback',
  providerLabel,
}) {
  const prefix = providerLabel ? `[${providerLabel}] ` : '';
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
        respond(res, 400, `${prefix}오류: code 파라미터가 없습니다.`);
        finish(new Error('callback에 code 파라미터가 없습니다.'));
        return;
      }

      if (state !== expectedState) {
        respond(res, 400, `${prefix}오류: state 값이 일치하지 않습니다.`);
        finish(new Error('state mismatch — CSRF 검증 실패'));
        return;
      }

      respond(res, 200, `${prefix}code/state 수신 완료. 이 창을 닫아도 됩니다.`);
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
      finish(
        new Error(
          `localhost callback 서버가 ${timeoutMs}ms 내에 응답을 받지 못해 타임아웃되었습니다.`,
        ),
      );
    }, timeoutMs);

    server.listen(port, '127.0.0.1');
  });
}
