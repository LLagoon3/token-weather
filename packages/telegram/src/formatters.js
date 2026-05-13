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
 * Telegram HTML 모드 안전 escape — `<` `>` `&` 3 문자만 처리.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Telegram HTML 모드의 `<pre>` 블록으로 wrap. 짧은 단일 메시지 용도 (4096 자
 * 한도 안 가까운 출력) — 4096 자에 근접하거나 entity expansion 영향이 큰 출력
 * 은 `formatPreChunksForTelegram` 사용.
 *
 * @param {string} text
 * @returns {string}
 */
export function wrapPre(text) {
  return `<pre>${escapeHtml(text)}</pre>`;
}

/**
 * 줄 단위 분할 helper — **raw text 길이 기준** 으로 chunking 한다. HTML escape
 * 후 entity expansion (`&` → `&amp;` 등) 은 고려하지 않으므로, escape 가 들어가는
 * 시나리오 (`<pre>` wrap 등) 에서는 `formatPreChunksForTelegram` 사용 권장. 본
 * 함수는 escape 가 없거나 영향이 작은 plain text 분할용.
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
 * raw text → HTML escape → `<pre>` wrap 까지 한 번에 처리해 Telegram 전송 가능한
 * 메시지 배열을 반환. `splitForTelegram` 이 raw 길이만 보던 한계 (entity
 * expansion 으로 4096 초과 가능) 를 보완 (PR #133 review).
 *
 * 알고리즘:
 *   1) raw 를 줄 단위로 split.
 *   2) 각 줄을 escapeHtml 로 변환.
 *   3) `<pre>` + `</pre>` (11 자) 까지 포함한 message 길이가 limit 이하가 되도록
 *      escape 된 줄을 누적 chunk 에 추가.
 *   4) 한 줄이 단독으로 limit 초과면 escape 후 글자 단위 강제 분할.
 *   5) 각 chunk 는 self-contained `<pre>...</pre>` 로 wrap 되어 반환.
 *
 * @param {string} rawText
 * @param {number} [limit=4000] - `<pre>` 포함 message 전체 길이 한도 (Telegram
 *   4096 마진 96).
 * @returns {string[]} 각 element 가 `<pre>...</pre>` 형태인 message 배열.
 */
export function formatPreChunksForTelegram(rawText, limit = 4000) {
  if (typeof rawText !== 'string') return [];
  if (rawText.length === 0) return [];
  const TAG_OPEN = '<pre>';
  const TAG_CLOSE = '</pre>';
  const contentLimit = limit - TAG_OPEN.length - TAG_CLOSE.length;
  const lines = rawText.split('\n');
  const chunks = [];
  let current = '';
  for (const line of lines) {
    const escapedLine = escapeHtml(line);
    if (escapedLine.length > contentLimit) {
      if (current) {
        chunks.push(`${TAG_OPEN}${current}${TAG_CLOSE}`);
        current = '';
      }
      // 한 줄이 단독 limit 초과 — raw character 단위 split 으로 HTML entity
      // (`&amp;` / `&lt;` / `&gt;`) 가 chunk 경계에서 끊기지 않도록 보호 (PR #134
      // review). escape 후 slice 하면 multi-char entity 가 중간에서 잘릴 수 있어
      // HTML parser 가 에러를 내거나 표현이 깨진다.
      for (const sub of splitRawByEscapedLength(line, contentLimit)) {
        chunks.push(`${TAG_OPEN}${sub}${TAG_CLOSE}`);
      }
      continue;
    }
    const next = current ? `${current}\n${escapedLine}` : escapedLine;
    if (next.length > contentLimit) {
      chunks.push(`${TAG_OPEN}${current}${TAG_CLOSE}`);
      current = escapedLine;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(`${TAG_OPEN}${current}${TAG_CLOSE}`);
  return chunks;
}

/**
 * raw character 를 한 글자씩 escape 하며 누적, escape 후 길이가 contentLimit 을
 * 넘으면 push + reset. entity boundary 가 깨지지 않음. (PR #134 review)
 *
 * @param {string} rawLine
 * @param {number} contentLimit
 * @returns {string[]}
 */
function splitRawByEscapedLength(rawLine, contentLimit) {
  const chunks = [];
  let current = '';
  for (const ch of rawLine) {
    let entity;
    if (ch === '&') entity = '&amp;';
    else if (ch === '<') entity = '&lt;';
    else if (ch === '>') entity = '&gt;';
    else entity = ch;
    if (current.length + entity.length > contentLimit) {
      if (current) chunks.push(current);
      current = '';
    }
    current += entity;
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
