/**
 * Telegram 전용 status / usage 출력 formatter — 모바일 폭 친화 compact 변형.
 *
 * issue #144: CLI 의 `formatStatusOutput` 은 데스크탑 80+ column 가정으로
 * `╭─` rounded box + `━━━━ ... ━━━━━` 50–55 column heavy rule + 50 column
 * progress bar 를 사용. 텔레그램 모바일 (폭 ~30–40 column) 에서 `<pre>`
 * 본문이 word wrap 되어 박스가 갈라지는 회귀가 있었음. 본 formatter 는 동일
 * snapshot 을 받아 모바일 폭 안에 들어가는 라인 배열을 만든다.
 *
 * issue #146: window 라인에 10-column `compactProgressBar` 를 추가해 사용량
 * 시각화를 복원. 박스 글리프 (`╭ │ ╰ ┌ └ ─`) 는 여전히 미사용 — bar 글리프
 * (`█ ░`) 만 의도된 출력.
 *
 * 디자인 가이드:
 *   - 라인 폭 목표 ≤ TELEGRAM_LINE_WIDTH (32 column)
 *   - rounded box 미사용. 10-column ASCII bar 만 허용
 *   - section 라벨은 짧은 `━━ Title ━━` heavy rule (모바일 폭 안)
 *   - 긴 값 (config path / email) 은 우측-우선 truncate
 *   - useColor / ANSI 무시 — 텔레그램 `<pre>` 는 monospace, ANSI 미지원
 *   - reset 시각 표기는 timezone 생략 (모바일 폭 확보, 사용자가 자기 tz 임을 인지)
 *
 * 본 모듈은 `@token-weather/cli` 를 import 하지 않는다 (PR #131 review 정책).
 * 입력 snapshot 의 shape 는 cli 의 `getStatusSnapshot()` 결과와 동일.
 */

import { compactProgressBar } from './telegram-progress-bar.js';

export const TELEGRAM_LINE_WIDTH = 32;
const WINDOW_LABEL_WIDTH = 9;
const WINDOW_BAR_WIDTH = 10;
const WINDOW_PCT_WIDTH = 4;

const SECTION_RULE = '━━';

/**
 * Telegram 출력 라인 배열.
 *
 * @param {object} snapshot — `getStatusSnapshot()` 결과
 * @param {{ now?: Date }} [ctx]
 * @returns {string[]}
 */
export function formatStatusForTelegram(snapshot, ctx = {}) {
  const lines = [];
  const now = ctx.now ?? new Date();

  lines.push(sectionHeader('Status'));
  lines.push(`Codex  ${enabledLabel(snapshot?.providers?.codex?.enabled)}`);
  lines.push(`Claude ${enabledLabel(snapshot?.providers?.claude?.enabled)}`);
  lines.push(`Sync   ${enabledLabel(snapshot?.sync?.enabled)}`);
  if (snapshot?.accountFilter) {
    lines.push(`Acct filter: ${truncate(snapshot.accountFilter, TELEGRAM_LINE_WIDTH - 13)}`);
  }
  if (snapshot?.providerFilter) {
    lines.push(`Prov filter: ${snapshot.providerFilter}`);
  }

  if (snapshot?.codex) {
    lines.push('');
    lines.push(...formatCodexSection(snapshot.codex, now));
  }
  if (snapshot?.claude) {
    lines.push('');
    lines.push(...formatClaudeSection(snapshot.claude, now));
  }
  return lines;
}

function formatCodexSection(codex, now) {
  const lines = [sectionHeader('Codex')];
  if (!codex.enabled) {
    lines.push('Disabled');
    return lines;
  }
  const snapshots = codex.usageSnapshots ?? [];
  if (snapshots.length === 0) {
    if (codex.filteredOut) {
      lines.push(
        `No match: ${truncate(String(codex.accountFilter ?? ''), TELEGRAM_LINE_WIDTH - 10)}`,
      );
    } else {
      lines.push('No Codex profile');
    }
    return lines;
  }
  for (let i = 0; i < snapshots.length; i++) {
    if (i > 0) lines.push('');
    lines.push(...formatAccountBlock('openai-codex', snapshots[i], now));
  }
  return lines;
}

function formatClaudeSection(claude, now) {
  const lines = [sectionHeader('Claude')];
  const snapshots = claude.usageSnapshots ?? [];
  if (snapshots.length === 0) {
    if (claude.filteredOut) {
      lines.push(
        `No match: ${truncate(String(claude.accountFilter ?? ''), TELEGRAM_LINE_WIDTH - 10)}`,
      );
    } else {
      lines.push('Skipped (disabled / no token)');
    }
    return lines;
  }
  for (let i = 0; i < snapshots.length; i++) {
    if (i > 0) lines.push('');
    lines.push(...formatAccountBlock('anthropic-claude', snapshots[i], now));
  }
  return lines;
}

function formatAccountBlock(providerId, snapshot, now) {
  const lines = [];
  const id = accountIdentifier(snapshot.account);
  const plan = snapshot.account?.plan;
  const headerParts = [id ?? providerLabel(providerId)];
  if (plan) headerParts.push(plan);
  lines.push(truncate(headerParts.join(' · '), TELEGRAM_LINE_WIDTH));

  if (snapshot.status?.ok) {
    lines.push(`✓ OK${snapshot.status.httpStatus ? ` (${snapshot.status.httpStatus})` : ''}`);
  } else {
    lines.push('✗ FAILED');
    if (snapshot.status?.message) {
      lines.push(`  ${truncate(trimMessage(snapshot.status.message), TELEGRAM_LINE_WIDTH - 2)}`);
    }
  }

  for (const window of snapshot.usageWindows ?? []) {
    lines.push(...formatWindowCompact(window, now));
  }
  return lines;
}

function formatWindowCompact(window, now) {
  // issue #146: label  bar  pct 한 줄 + reset 들여쓴 줄.
  // 폭: '· ' (2) + label padEnd(9) + space (1) + bar (10) + space (1) +
  // pct padStart(4) = 27 자 ≤ TELEGRAM_LINE_WIDTH (32).
  const labelText = truncate(compactWindowLabel(window), WINDOW_LABEL_WIDTH);
  const label = labelText.padEnd(WINDOW_LABEL_WIDTH);
  const bar = compactProgressBar(window?.usedPercent, WINDOW_BAR_WIDTH);
  const pct = formatPercent(window?.usedPercent).padStart(WINDOW_PCT_WIDTH);
  const reset = compactResetTime(window?.resetAt, now);
  return [`· ${label} ${bar} ${pct}`, `  reset ${truncate(reset, TELEGRAM_LINE_WIDTH - 8)}`];
}

function sectionHeader(title) {
  return `${SECTION_RULE} ${title} ${SECTION_RULE}`;
}

function enabledLabel(enabled) {
  return enabled ? 'enabled' : 'disabled';
}

function accountIdentifier(account) {
  if (!account) return null;
  return account.email ?? account.accountId ?? account.accountKey ?? account.profileId ?? null;
}

function providerLabel(providerId) {
  if (providerId === 'openai-codex') return 'codex';
  if (providerId === 'anthropic-claude') return 'claude';
  return providerId;
}

/**
 * window kind → 모바일 친화 짧은 라벨. CLI 의 WINDOW_LABELS 와 의도적으로
 * 다름 — `'Current session (5h)'` 같은 긴 라벨이 32 column 에 안 들어옴.
 */
function compactWindowLabel(window) {
  const kind = window?.kind;
  const compact = {
    five_hour: '5h',
    seven_day: '7d',
    seven_day_sonnet: '7d sonnet',
    seven_day_opus: '7d opus',
    primary: 'primary',
    secondary: 'secondary',
  };
  if (kind && compact[kind]) return compact[kind];
  if (window?.label) return truncate(window.label, 16);
  if (kind) return truncate(kind, 16);
  return 'window';
}

function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value)}%`;
}

function trimMessage(message) {
  if (typeof message !== 'string') return String(message ?? '');
  const idx = message.indexOf(' — ');
  return idx >= 0 ? message.slice(0, idx) : message;
}

function truncate(value, limit) {
  const text = String(value ?? '');
  if (text.length <= limit) return text;
  if (limit <= 1) return '…';
  return `${text.slice(0, limit - 1)}…`;
}

/**
 * Reset 시각 모바일 친화 표기 — timezone 생략.
 *
 *   - 잘못된 입력 → 'unknown' / 원문
 *   - 같은 day (now 기준) → `9pm` 또는 `9:42pm`
 *   - 다른 day → `Sat 9pm` 또는 `May 15 9pm`
 */
export function compactResetTime(isoDate, now = new Date()) {
  if (!isoDate) return 'unknown';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return String(isoDate);

  const hour = d.getHours();
  const min = d.getMinutes();
  const ampm = hour < 12 ? 'am' : 'pm';
  const h12 = hour % 12 || 12;
  const timeStr = min === 0 ? `${h12}${ampm}` : `${h12}:${String(min).padStart(2, '0')}${ampm}`;

  if (d.toDateString() === now.toDateString()) return timeStr;

  const diffDays = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (diffDays > 0 && diffDays < 7) {
    const weekday = d.toLocaleString('en-US', { weekday: 'short' });
    return `${weekday} ${timeStr}`;
  }
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${month} ${d.getDate()} ${timeStr}`;
}
