import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  stripAnsi,
  wrapPre,
  splitForTelegram,
  formatPreChunksForTelegram,
  formatErrorForTelegram,
} from '../src/formatters.js';

const ESC = String.fromCharCode(0x1b);

describe('stripAnsi', () => {
  it('ANSI CSI sequence 제거', () => {
    assert.equal(stripAnsi(`${ESC}[31mred${ESC}[0m`), 'red');
    assert.equal(stripAnsi(`${ESC}[1;33mbold yellow${ESC}[0m`), 'bold yellow');
  });

  it('일반 텍스트 그대로 통과', () => {
    assert.equal(stripAnsi('plain text'), 'plain text');
    assert.equal(stripAnsi(''), '');
  });

  it('non-string 은 그대로 반환', () => {
    assert.equal(stripAnsi(null), null);
    assert.equal(stripAnsi(undefined), undefined);
    assert.equal(stripAnsi(42), 42);
  });

  it('일반 대괄호 표현은 ANSI 가 아니므로 보존', () => {
    assert.equal(stripAnsi('[hello]'), '[hello]');
    assert.equal(stripAnsi('arr[0]'), 'arr[0]');
  });
});

describe('wrapPre', () => {
  it('HTML 모드 안전 escape + <pre> wrap', () => {
    assert.equal(wrapPre('hello'), '<pre>hello</pre>');
    assert.equal(wrapPre('<tag>'), '<pre>&lt;tag&gt;</pre>');
    assert.equal(wrapPre('a & b'), '<pre>a &amp; b</pre>');
  });

  it('& 가 다른 entity 안에 있어도 먼저 escape (이중 escape 방지)', () => {
    assert.equal(wrapPre('&lt;'), '<pre>&amp;lt;</pre>');
  });

  it('non-string 입력도 string 변환', () => {
    assert.equal(wrapPre(42), '<pre>42</pre>');
  });
});

describe('splitForTelegram', () => {
  it('limit 이하 한 chunk', () => {
    assert.deepEqual(splitForTelegram('hello', 100), ['hello']);
  });

  it('빈 문자열은 빈 배열', () => {
    assert.deepEqual(splitForTelegram(''), []);
  });

  it('non-string 은 빈 배열', () => {
    assert.deepEqual(splitForTelegram(null), []);
    assert.deepEqual(splitForTelegram(undefined), []);
  });

  it('줄 단위 split — 결합 시 limit 초과면 다음 chunk', () => {
    // limit=12, 3 줄 (각 5자). 'aaaaa\nbbbbb'=11(≤12) 한 chunk, 다음 'ccccc'.
    const chunks = splitForTelegram('aaaaa\nbbbbb\nccccc', 12);
    assert.deepEqual(chunks, ['aaaaa\nbbbbb', 'ccccc']);
  });

  it('한 줄이 limit 초과면 글자 단위 강제 분할', () => {
    const long = 'x'.repeat(25);
    const chunks = splitForTelegram(long, 10);
    assert.equal(chunks.length, 3);
    assert.equal(chunks[0], 'x'.repeat(10));
    assert.equal(chunks[1], 'x'.repeat(10));
    assert.equal(chunks[2], 'x'.repeat(5));
  });

  it('모든 chunk 가 limit 이하임을 보장', () => {
    const input = `${'a'.repeat(50)}\n${'b'.repeat(50)}\n${'c'.repeat(50)}`;
    const chunks = splitForTelegram(input, 60);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 60, `chunk size ${chunk.length} exceeds limit 60`);
    }
  });
});

describe('formatPreChunksForTelegram (PR #133 review)', () => {
  it('빈 입력은 빈 배열', () => {
    assert.deepEqual(formatPreChunksForTelegram(''), []);
    assert.deepEqual(formatPreChunksForTelegram(null), []);
    assert.deepEqual(formatPreChunksForTelegram(undefined), []);
  });

  it('짧은 입력은 1 chunk 로 wrap', () => {
    assert.deepEqual(formatPreChunksForTelegram('hello'), ['<pre>hello</pre>']);
  });

  it('HTML escape 적용 — `<`, `>`, `&`', () => {
    const out = formatPreChunksForTelegram('a <b> & c');
    assert.deepEqual(out, ['<pre>a &lt;b&gt; &amp; c</pre>']);
  });

  it('각 chunk 가 limit 이하 (tag 포함) — entity expansion 영향 포함', () => {
    // `&` 30 개 = 30 자 raw, escape 후 150 자. limit=80 이면 여러 chunk 로 split.
    const input = '&'.repeat(30);
    const chunks = formatPreChunksForTelegram(input, 80);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 80, `chunk length ${chunk.length} exceeds limit 80`);
    }
    // 각 chunk 가 self-contained <pre>...</pre>.
    for (const chunk of chunks) {
      assert.ok(chunk.startsWith('<pre>'));
      assert.ok(chunk.endsWith('</pre>'));
    }
    // 복원하면 원본 escape 와 일치.
    const reassembled = chunks
      .map((c) => c.slice('<pre>'.length, c.length - '</pre>'.length))
      .join('');
    assert.equal(reassembled, '&amp;'.repeat(30));
  });

  it('한 줄이 limit 초과 — escape 후 글자 단위 강제 분할', () => {
    const input = 'x'.repeat(200);
    const chunks = formatPreChunksForTelegram(input, 100);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 100);
      assert.ok(chunk.startsWith('<pre>'));
      assert.ok(chunk.endsWith('</pre>'));
    }
  });

  it('split 시 HTML entity 가 chunk 경계에서 깨지지 않음 (PR #134 review)', () => {
    // `&` 만 30 개 — escape 후 `&amp;` (5 자) * 30 = 150 자. limit=20 이면 tag
    // overhead 11 + contentLimit 9 — 한 chunk 당 entity 1 개 (5 자) 만 들어가야.
    const input = '&'.repeat(30);
    const chunks = formatPreChunksForTelegram(input, 20);
    for (const chunk of chunks) {
      const content = chunk.slice('<pre>'.length, chunk.length - '</pre>'.length);
      // entity 가 깨지지 않음: content 안의 `&` 가 항상 `&amp;` 시퀀스를 시작.
      // 즉 `&` 다음에 'amp;' 가 와야 함 — 단독 `&` 또는 `&am` 같은 잘린 entity X.
      assert.ok(
        /^(&amp;|&lt;|&gt;)*$/.test(content),
        `chunk content "${content}" must be a clean concatenation of complete entities`,
      );
    }
    // 복원하면 원본과 일치 — entity 총 30 개.
    const reassembled = chunks
      .map((c) => c.slice('<pre>'.length, c.length - '</pre>'.length))
      .join('');
    assert.equal(reassembled, '&amp;'.repeat(30));
  });

  it('split 시 `<` `>` 도 entity boundary 보존', () => {
    const input = '<>'.repeat(30); // escape 후 `&lt;&gt;` (8 자) * 30 = 240 자.
    const chunks = formatPreChunksForTelegram(input, 20);
    for (const chunk of chunks) {
      const content = chunk.slice('<pre>'.length, chunk.length - '</pre>'.length);
      assert.ok(
        /^(&amp;|&lt;|&gt;)*$/.test(content),
        `chunk content "${content}" must be a clean concatenation of complete entities`,
      );
    }
  });

  it('줄바꿈 보존 — `\\n` 으로 구분된 두 줄이 한 chunk 에 들어감', () => {
    const out = formatPreChunksForTelegram('line one\nline two');
    assert.deepEqual(out, ['<pre>line one\nline two</pre>']);
  });
});

describe('formatErrorForTelegram', () => {
  it('Error 의 name + message 만 노출 (stack 없음)', () => {
    const err = new TypeError('something broke');
    const out = formatErrorForTelegram(err);
    assert.match(out, /<pre>TypeError: something broke<\/pre>/);
    assert.doesNotMatch(out, /at /); // stack 의 "at " 패턴 부재.
  });

  it('plain object 도 name / message 추출', () => {
    const out = formatErrorForTelegram({ name: 'CustomErr', message: 'oops' });
    assert.equal(out, '<pre>CustomErr: oops</pre>');
  });

  it('non-object 는 String() 으로 직렬화', () => {
    assert.match(formatErrorForTelegram('plain string'), /<pre>Error: plain string<\/pre>/);
    assert.match(formatErrorForTelegram(42), /<pre>Error: 42<\/pre>/);
  });

  it('HTML escape 적용 (XSS 방지)', () => {
    const out = formatErrorForTelegram(new Error('<script>'));
    assert.match(out, /&lt;script&gt;/);
  });
});
