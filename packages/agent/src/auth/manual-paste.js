/**
 * Manual paste fallback — reads callback URL or authorization code from stdin.
 *
 * Used when localhost callback is unavailable (SSH, container, port conflict).
 */

import { createInterface } from 'node:readline';

/**
 * Prompt the user for a callback URL or authorization code via stdin.
 *
 * Accepts either:
 * - Full callback URL (e.g. http://127.0.0.1:19876/callback?code=abc&state=xyz)
 * - Raw authorization code string
 *
 * @returns {Promise<{ type: 'url' | 'code', value: string }>}
 */
export async function readManualPasteInput() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const input = await new Promise((resolve) => {
    rl.question('콜백 URL 전체 또는 authorization code를 붙여넣으세요:\n> ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!input) {
    return { type: 'code', value: '', error: 'empty-input' };
  }

  if (looksLikeUrl(input)) {
    return { type: 'url', value: input };
  }

  return { type: 'code', value: input };
}

/**
 * Extract authorization code from a callback URL or raw code string.
 *
 * @param {{ type: 'url' | 'code', value: string }} pasteResult
 * @returns {{ code: string | null, state: string | null, error: string | null }}
 */
export function extractCodeFromPaste(pasteResult) {
  if (pasteResult.error) {
    return { code: null, state: null, error: pasteResult.error };
  }

  if (pasteResult.type === 'code') {
    return { code: pasteResult.value, state: null, error: null };
  }

  try {
    const url = new URL(pasteResult.value);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      return { code: null, state, error: 'no-code-in-url' };
    }

    return { code, state, error: null };
  } catch {
    return { code: null, state: null, error: 'invalid-url' };
  }
}

function looksLikeUrl(input) {
  return input.startsWith('http://') || input.startsWith('https://');
}
