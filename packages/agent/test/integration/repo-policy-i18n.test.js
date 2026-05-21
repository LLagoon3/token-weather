/**
 * Repo-level i18n drift 가드.
 *
 * issue #154 의 Phase 2 결과 (README / SECURITY dual + 외부 docs 7 개 영문 본)
 * 가 PR / commit 으로 우발적으로 깨지는 회귀를 잡는다. CONTRIBUTING §10 의 dual
 * 정책과 정합.
 *
 * 검사 항목:
 *   1. dual 대상 파일 존재 (README.ko.md, SECURITY.ko.md, docs/*.en.md 7 개)
 *   2. 양쪽 파일 상단의 dual language 링크 + 번역 footer
 *   3. README 영어 본의 docs link 가 외부 가시 docs 7개 모두 `.en.md` 정합
 *   4. 한글 source 의 한글 헤더 존재 (drift 방어막)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

// 외부 가시 docs 7개 — CONTRIBUTING §10 의 "한글 default + 영문 추가" 카테고리
const EXTERNAL_DOCS = [
  'architecture',
  'auth-architecture',
  'auth-cli',
  'cli-json-output',
  'provider-notes',
  'telegram-bot',
  'typescript-consumers',
];

describe('repo-policy/i18n — dual 대상 파일 존재 (issue #154 §10)', () => {
  it('README 양쪽 (.md + .ko.md) 존재', () => {
    assert.ok(exists('README.md'), 'README.md (영어 default)');
    assert.ok(exists('README.ko.md'), 'README.ko.md (한글 source)');
  });

  it('SECURITY 양쪽 (.md + .ko.md) 존재', () => {
    assert.ok(exists('SECURITY.md'), 'SECURITY.md (영어 default)');
    assert.ok(exists('SECURITY.ko.md'), 'SECURITY.ko.md (한글 source)');
  });

  for (const name of EXTERNAL_DOCS) {
    it(`docs/${name} 양쪽 (.md + .en.md) 존재`, () => {
      assert.ok(exists(`docs/${name}.md`), `docs/${name}.md (한글 source)`);
      assert.ok(exists(`docs/${name}.en.md`), `docs/${name}.en.md (영문 번역)`);
    });
  }
});

describe('repo-policy/i18n — 양쪽 파일 상단 dual language 링크 (CONTRIBUTING §10)', () => {
  const PAIRS = [
    // 영문 default + 한글 보존 (root)
    { en: 'README.md', ko: 'README.ko.md', enRef: 'README.md', koRef: 'README.ko.md' },
    { en: 'SECURITY.md', ko: 'SECURITY.ko.md', enRef: 'SECURITY.md', koRef: 'SECURITY.ko.md' },
    // 한글 default + 영문 추가 (docs/*) — Codex review PR #160 P2 nit 1
    ...EXTERNAL_DOCS.map((name) => ({
      en: `docs/${name}.en.md`,
      ko: `docs/${name}.md`,
      enRef: `${name}.en.md`,
      koRef: `${name}.md`,
    })),
  ];

  for (const { en, ko, enRef, koRef } of PAIRS) {
    it(`${en} (영어 default) 상단에 한국어 본 링크 포함`, () => {
      const body = read(en);
      assert.match(body, /🌐/, 'globe 글리프로 시작하는 dual link');
      assert.ok(body.includes(`(./${koRef})`), `한국어 본 (${koRef}) 링크`);
    });

    it(`${ko} (한글 source) 상단에 영어 본 링크 포함`, () => {
      const body = read(ko);
      assert.match(body, /🌐/, 'globe 글리프로 시작하는 dual link');
      assert.ok(body.includes(`(./${enRef})`), `영어 본 (${enRef}) 링크`);
    });
  }
});

describe('repo-policy/i18n — 영문 본 번역 footer (CONTRIBUTING §10)', () => {
  const EN_BODIES = [
    { rel: 'README.md', src: 'README.ko.md' },
    { rel: 'SECURITY.md', src: 'SECURITY.ko.md' },
    ...EXTERNAL_DOCS.map((name) => ({ rel: `docs/${name}.en.md`, src: `${name}.md` })),
  ];

  for (const { rel, src } of EN_BODIES) {
    it(`${rel} 가 "Translated from ${src}" footer 포함`, () => {
      const body = read(rel);
      // "Translated from [X](./X)" 또는 "Translated from X" 모두 매치
      const re = new RegExp(`Translated from .*${src.replace(/\./g, '\\.')}`);
      assert.match(body, re, `번역 footer (last sync + CONTRIBUTING §10 ref)`);
    });

    it(`${rel} 가 last sync 날짜 포함`, () => {
      const body = read(rel);
      assert.match(body, /last sync \d{4}-\d{2}-\d{2}/i, 'YYYY-MM-DD 형식 last sync');
    });
  }
});

describe('repo-policy/i18n — README 영어 본의 외부 docs link 가 .en.md 정합', () => {
  const README_EN = read('README.md');

  for (const name of EXTERNAL_DOCS) {
    it(`README 가 docs/${name}.en.md 링크 포함 (한글 .md 가 아닌)`, () => {
      const escaped = `docs/${name}.en.md`.replace(/\./g, '\\.').replace(/\//g, '\\/');
      const re = new RegExp(`\\(\\.\\/${escaped}\\)`);
      assert.match(README_EN, re, `${name} 영문 본 링크 (회귀 시 한글 .md 로 돌아가지 않도록)`);
    });
  }
});

describe('repo-policy/i18n — 한글 source 의 한글 헤더 (drift 방어막)', () => {
  it('README.ko.md 가 한글 핵심 섹션 헤더 포함', () => {
    const body = read('README.ko.md');
    // CONTRIBUTING §10 의 source of truth 가 한글이므로 한글 헤더가 사라지면
    // sync 가 잘못된 방향 (영어 → 한글 역번역) 으로 흘러간 신호.
    const REQUIRED = ['## 지원 provider', '## 명령', '## 보안', '## 라이선스'];
    for (const heading of REQUIRED) {
      assert.match(body, new RegExp(`^${heading.replace(/\//g, '\\/')}`, 'm'), heading);
    }
  });

  it('SECURITY.ko.md 가 한글 핵심 섹션 헤더 포함', () => {
    const body = read('SECURITY.ko.md');
    assert.match(body, /## 지원 버전/m);
    assert.match(body, /## 비공개 신고 채널/m);
  });
});
