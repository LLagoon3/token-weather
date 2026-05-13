/**
 * Telegram 응답 전용 텍스트 가공 helpers.
 *
 * 본 모듈의 모든 함수는 pure — Telegram API 와 직접 통신하지 않는다.
 * bot-server.js 또는 Phase 3 의 handler 가 결과 메시지를 만들 때 호출.
 */

// ESC (0x1b) + [ + ... + letter — generic CSI sequence. ESC 문자를 정규식 리터럴에
// 직접 넣으면 eslint no-control-regex 가 잡으므로 RegExp 생성자로 우회. String.
// fromCharCode 가 lint-safe 한 ESC 문자 산출.
const ANSI_CSI_PATTERN = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*[A-Za-z]`, 'g');

/**
 * ANSI escape sequence (CSI) 를 제거한다. token-weather 의 평문 출력은
 * `shouldUseColor === false` 면 ANSI 가 안 들어가지만, daemon 내 다른 stdio
 * helper 가 색을 넣을 가능성에 대한 방어적 strip.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripAnsi(text) {
  if (typeof text !== 'string') return text;
  return text.replace(ANSI_CSI_PATTERN, '');
}

/**
 * Telegram HTML 모드의 `<pre>` 블록으로 wrap. `<` `>` `&` 3 문자만 escape.
 *
 * @param {string} text
 * @returns {string}
 */
export function wrapPre(text) {
  const escaped = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<pre>${escaped}</pre>`;
}

/**
 * Telegram 메시지 1 건의 최대 길이 (4096 자) 에 안전 마진을 두고 줄 단위로 split.
 * `<pre>` wrap 의 tag overhead 까지 감안해 기본 limit 은 4000.
 *
 * 한 줄 자체가 limit 초과면 글자 단위로 강제 분할.
 *
 * @param {string} text
 * @param {number} [limit=4000]
 * @returns {string[]}
 */
export function splitForTelegram(text, limit = 4000) {
  if (typeof text !== 'string') return [];
  if (text.length === 0) return [];
  if (text.length <= limit) return [text];
  const lines = text.split('\n');
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if (line.length > limit) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let i = 0; i < line.length; i += limit) {
        chunks.push(line.slice(i, i + limit));
      }
      continue;
    }
    const next = current ? `${current}\n${line}` : line;
    if (next.length > limit) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * 에러를 Telegram <pre> 블록으로 안전 직렬화. stack trace 는 노출하지 않고
 * name + message 만 표시 — 정보 노출 최소화.
 *
 * @param {unknown} err
 * @returns {string}
 */
export function formatErrorForTelegram(err) {
  const name = err && typeof err === 'object' && 'name' in err ? err.name : 'Error';
  const msg = err && typeof err === 'object' && 'message' in err ? err.message : String(err);
  return wrapPre(`${name}: ${msg}`);
}
