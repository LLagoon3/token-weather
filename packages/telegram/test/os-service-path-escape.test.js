import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  escapeSystemdArg,
  escapePlistXml,
  escapeSchtasksArg,
} from '../src/os-service-path-escape.js';

describe('escapeSystemdArg (issue #141)', () => {
  it('정상 alphanumeric 경로 — double-quote wrap', () => {
    assert.equal(escapeSystemdArg('/usr/bin/node'), '"/usr/bin/node"');
  });

  it('공백 포함 경로 — quote 안에서 안전 (Windows 표준 Node 설치 환경)', () => {
    assert.equal(
      escapeSystemdArg('C:\\Program Files\\nodejs\\node.exe'),
      '"C:\\\\Program Files\\\\nodejs\\\\node.exe"',
    );
  });

  it('백슬래시 escape (`\\` → `\\\\`)', () => {
    assert.equal(escapeSystemdArg('a\\b'), '"a\\\\b"');
  });

  it('내부 double-quote escape (`"` → `\\"`)', () => {
    assert.equal(escapeSystemdArg('path with "quote"'), '"path with \\"quote\\""');
  });

  it('백슬래시 + double-quote 조합 — 순서 정확 (\\\\ 먼저, 그 다음 \\")', () => {
    // 'a\"b' → 백슬래시 escape → 'a\\\"b' → double-quote escape → 'a\\\\"b'
    // wait: input 'a\\"b' (백슬래시 + 따옴표)
    // 백슬래시 먼저: '\\' → '\\\\', 그 다음 '"' → '\\"'
    // 'a' + '\\' + '"' + 'b' → 'a' + '\\\\' + '\\"' + 'b' = 'a\\\\\\"b'
    assert.equal(escapeSystemdArg('a\\"b'), '"a\\\\\\"b"');
  });

  it('빈 입력 → 빈 quote `""`', () => {
    assert.equal(escapeSystemdArg(''), '""');
    assert.equal(escapeSystemdArg(null), '""');
    assert.equal(escapeSystemdArg(undefined), '""');
  });

  it('shell metacharacter ($, `, ;) 는 escape 불필요 — systemd 는 direct exec', () => {
    assert.equal(escapeSystemdArg('$HOME/node'), '"$HOME/node"');
    assert.equal(escapeSystemdArg('a`b'), '"a`b"');
    assert.equal(escapeSystemdArg('a;b'), '"a;b"');
  });
});

describe('escapePlistXml (issue #141)', () => {
  it('정상 경로 — 변경 없음', () => {
    assert.equal(escapePlistXml('/usr/local/bin/node'), '/usr/local/bin/node');
  });

  it('& → &amp; (가장 먼저 처리되어 후속 entity 가 다시 escape 되지 않음)', () => {
    assert.equal(escapePlistXml('a & b'), 'a &amp; b');
    assert.equal(escapePlistXml('&amp;'), '&amp;amp;');
  });

  it('< → &lt;, > → &gt;', () => {
    assert.equal(escapePlistXml('<weird>'), '&lt;weird&gt;');
  });

  it('attribute escape (싱글/더블 quote) 는 적용 안 됨 — element content 만', () => {
    assert.equal(escapePlistXml('path \'with\' "quotes"'), 'path \'with\' "quotes"');
  });

  it('null / undefined → 빈 문자열', () => {
    assert.equal(escapePlistXml(null), '');
    assert.equal(escapePlistXml(undefined), '');
  });

  it('숫자 / 기타 type 도 String 변환 후 escape', () => {
    assert.equal(escapePlistXml(42), '42');
  });
});

describe('escapeSchtasksArg (issue #141)', () => {
  it('정상 alphanumeric 경로 — escape 된 quote (\\") 로 wrap', () => {
    // 호출 측이 outer "..." 안에 넣으면 cmd 가 `"..."` literal quote 로 해석.
    assert.equal(escapeSchtasksArg('C:\\nodejs\\node.exe'), '\\"C:\\nodejs\\node.exe\\"');
  });

  it('공백 포함 경로 — Windows 표준 Node 설치 환경', () => {
    assert.equal(
      escapeSchtasksArg('C:\\Program Files\\nodejs\\node.exe'),
      '\\"C:\\Program Files\\nodejs\\node.exe\\"',
    );
  });

  it('백슬래시는 그대로 (Windows path separator 보존)', () => {
    assert.equal(escapeSchtasksArg('a\\b\\c'), '\\"a\\b\\c\\"');
  });

  it('내부 double-quote escape ("" — cmd.exe quote-in-quote, defensive)', () => {
    assert.equal(escapeSchtasksArg('a"b'), '\\"a""b\\"');
  });

  it('빈 입력 → 빈 escape quote', () => {
    assert.equal(escapeSchtasksArg(''), '\\"\\"');
    assert.equal(escapeSchtasksArg(null), '\\"\\"');
    assert.equal(escapeSchtasksArg(undefined), '\\"\\"');
  });
});
