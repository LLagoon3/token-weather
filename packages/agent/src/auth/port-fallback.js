/**
 * Port fallback helper for localhost callback server.
 *
 * Policy (from docs/auth-cli.md):
 * - Default port: 1455 (OpenClaw/Codex 관례. Claude는 `/callback` path를 쓰되 포트는 공유)
 * - On conflict: try +1, +2, +3 (max 3 retries)
 * - If all fail: signal caller to switch to manual paste
 * - If user specified --port: try only that port, fail on conflict
 *
 * 1455 기본값은 provider별 spec에서 `defaultPort`로 덮어쓸 수 있다.
 */

import { createServer } from 'node:net';

export const DEFAULT_CALLBACK_PORT = 1455;
export const MAX_PORT_RETRIES = 3;

/**
 * Check whether a given port is available on 127.0.0.1.
 * Resolves to true if available, false otherwise.
 */
export function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find an available callback port according to the fallback policy.
 *
 * @param {object} [options]
 * @param {number|null} [options.preferredPort=null] - User-specified port via --port
 * @param {number} [options.defaultPort=DEFAULT_CALLBACK_PORT] - provider별로 덮어쓸 수 있는 시작 포트
 * @param {number} [options.maxRetries=MAX_PORT_RETRIES]
 * @returns {Promise<{ port: number|null, fallbackExhausted: boolean }>}
 *   port            – the available port, or null if none found
 *   fallbackExhausted – true when all automatic retries failed (caller should switch to manual paste)
 */
export async function resolveCallbackPort({
  preferredPort = null,
  defaultPort = DEFAULT_CALLBACK_PORT,
  maxRetries = MAX_PORT_RETRIES,
} = {}) {
  // User explicitly specified a port — try only that one
  if (preferredPort != null) {
    const available = await isPortAvailable(preferredPort);
    return available
      ? { port: preferredPort, fallbackExhausted: false }
      : { port: null, fallbackExhausted: false };
  }

  // Default port + up to maxRetries fallback attempts
  for (let i = 0; i <= maxRetries; i++) {
    const candidate = defaultPort + i;
    const available = await isPortAvailable(candidate);
    if (available) {
      return { port: candidate, fallbackExhausted: false };
    }
  }

  // All candidates occupied
  return { port: null, fallbackExhausted: true };
}
