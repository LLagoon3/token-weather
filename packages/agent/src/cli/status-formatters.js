/**
 * status / usage 출력 pure formatters.
 *
 * 모든 함수는 string[] 반환, console.log 호출 없음. status-command.js 의
 * runStatusCommand 가 결과를 출력한다.
 *
 * 출력 언어는 영어 (사용자가 평문에서 한글 제외 요청, issue #116).
 * 평문은 stable contract 아님 (docs/cli-json-output.md). `--json` 출력의
 * shape / SCHEMA_VERSION 만 stable.
 *
 * 시각 계층 (heavy / light weight 대비로 4 단계 표현):
 *   L1 (top summary) — `━━━━ Agent Status Summary ━━━━…` + label 없는 박스
 *   L2 (provider)    — `━━━━ Codex usage ━━━━…` (박스 없음)
 *   L3 (account)     — `╭─ provider | identifier … ╰─` 라운드 코너 박스
 *   L4 (window)      — 인라인 3 줄 block (label / bar+pct / Resets)
 *
 * 막대 시각화: 1/8 정밀도 fractional 블록 `█▏▎▍▌▋▊▉`, 빈 자리는 light shade
 * `░` (PR #117 review — space 는 막대 끝이 안 보임 회귀 해결).
 */

import { formatProgressBar, formatResetTime, formatWindowLabel } from './status-bar-helper.js';

const BAR_WIDTH = 50;
const PROVIDER_HEADER_WIDTH = 55;
const PROVIDER_HEADER_MIN_PADDING = 3;

// 계정 박스 — rounded corners 좌측 vertical bar. 다 계정일 때만 적용.
// 4면 완전 박스는 ANSI escape / CJK char width 계산 이슈로 보류 — 좌측 +
// 상/하 corner 만으로 시각적 박스감 충분, 폭에 의존하지 않아 안정적.
const BOX_TOP_CORNER = '╭─';
const BOX_BOTTOM_CORNER = '╰─';
const BOX_VERTICAL = '│';

// ── pure helpers (top-of-file 그룹화) ───────────────────────────────────────

/**
 * Provider section header — `━━━━ Name ━━━━━━━━━━━━` 인라인 형식.
 * heavy single horizontal `━` 로 계정 박스의 light `─` 와 weight 대비 →
 * provider 가 account 보다 상위 계층임을 시각적으로 표현.
 *
 * @param {string} name
 * @returns {string}
 */
function providerHeader(name) {
  const prefix = '━━━━ ';
  const middle = `${name} `;
  const padLen = Math.max(
    PROVIDER_HEADER_MIN_PADDING,
    PROVIDER_HEADER_WIDTH - prefix.length - middle.length,
  );
  return `${prefix}${middle}${'━'.repeat(padLen)}`;
}

/**
 * 계정 헤더 라벨 — `provider | identifier` 형식.
 *
 * identifier 우선순위: email → accountId → accountKey → profileId. 넷 다 없으면
 * provider 단독. issue #116 review 의 lean output 정합. profileId 는 v0.5.0
 * (issue #120) 에서 usageSnapshots[] 원소의 snapshot.account 가 wrapper 없이
 * 직접 들어오면서 fallback 추가됨.
 *
 * @param {string} providerId — `'openai-codex'` / `'anthropic-claude'` 등
 * @param {object|null|undefined} account
 * @returns {string}
 */
function accountLabel(providerId, account) {
  const identifier =
    account?.email ?? account?.accountId ?? account?.accountKey ?? account?.profileId ?? null;
  return identifier ? `${providerId} | ${identifier}` : providerId;
}

/**
 * 실패 메시지에서 ` — ` 이후 raw payload (JSON 등) 를 제거한다.
 *
 * provider 어댑터가 던지는 에러는 보통
 * `"Claude token refresh failed: 400 Bad Request — {...JSON...}"` 형태인데,
 * 사용자에게는 사람이 읽기 좋은 prefix 만 노출하는 게 lean. JSON 본문이
 * 필요하면 `--json` 출력의 `status.message` 원본을 사용.
 *
 * @param {unknown} message
 * @returns {string|null}
 */
function trimErrorMessage(message) {
  if (typeof message !== 'string') return message ?? null;
  const idx = message.indexOf(' — ');
  return idx >= 0 ? message.slice(0, idx) : message;
}

/**
 * 본문 라인 배열을 rounded-corner 박스로 감싼다.
 *
 * 두 가지 use case:
 *   1. 다 계정일 때 각 계정 블록 — `header = 'provider | identifier'`
 *   2. top-level summary — `header = ''` (section title 이 이미 위쪽
 *      heavy rule 에 있어 박스 헤더 라벨 없이 corner 만)
 *
 * 입력 bodyLines 의 leading indent (`bodyIndentPrefix`, 기본 `'  '`) 는
 * `${BOX_VERTICAL} ` 로 교체되어 시각 폭이 동일하게 유지된다. 빈 줄은
 * `${BOX_VERTICAL}` 만 남긴다.
 *
 * @param {string} header — 박스 상단 라벨 (빈 문자열이면 corner 만)
 * @param {string[]} bodyLines
 * @param {string} [outerIndent=''] — 박스 전체를 들여쓸 추가 indent
 * @param {string} [bodyIndentPrefix='  '] — 본문에 이미 들어있는 leading
 *   indent. 박스 vertical 로 치환할 prefix.
 * @returns {string[]}
 */
function wrapInBox(header, bodyLines, outerIndent = '', bodyIndentPrefix = '  ') {
  const topLine = header
    ? `${outerIndent}${BOX_TOP_CORNER} ${header}`
    : `${outerIndent}${BOX_TOP_CORNER}`;
  const lines = [topLine];
  for (const line of bodyLines) {
    if (line === '') {
      lines.push(`${outerIndent}${BOX_VERTICAL}`);
    } else if (line.startsWith(bodyIndentPrefix)) {
      lines.push(`${outerIndent}${BOX_VERTICAL} ${line.slice(bodyIndentPrefix.length)}`);
    } else {
      // 예상치 못한 indent — 그대로 prefix 부착해서 안전 fallback
      lines.push(`${outerIndent}${BOX_VERTICAL} ${line}`);
    }
  }
  lines.push(`${outerIndent}${BOX_BOTTOM_CORNER}`);
  return lines;
}

// ── public formatters ──────────────────────────────────────────────────────

/**
 * 전체 status 출력 라인 배열.
 *
 * `snapshot.providerFilter` 가 지정되어 있으면 매칭되지 않는 provider 섹션은
 * 출력하지 않는다. ctx.useColor 는 호출자(runStatusCommand)에서 결정 후 주입.
 *
 * @param {object} snapshot
 * @param {{ useColor?: boolean, now?: Date }} [ctx]
 * @returns {string[]}
 */
export function formatStatusOutput(snapshot, ctx = {}) {
  const lines = [providerHeader('Agent Status Summary'), ''];

  const body = [
    `  Config: ${snapshot.configPath}`,
    `  Codex: ${snapshot.providers.codex.enabled ? 'enabled' : 'disabled'}`,
    `  Claude: ${snapshot.providers.claude.enabled ? 'enabled' : 'disabled'}`,
    `  Server sync: ${snapshot.sync.enabled ? 'enabled' : 'disabled'}`,
  ];
  if (snapshot.accountFilter) {
    body.push(`  Account filter: ${snapshot.accountFilter}`);
  }
  if (snapshot.providerFilter) {
    body.push(`  Provider filter: ${snapshot.providerFilter}`);
  }
  // heavy-rule header 와 box (label 없음 — section title 이 이미 위에 있음).
  lines.push(...wrapInBox('', body));

  if (snapshot.codex) {
    lines.push('', ...formatCodexSection(snapshot.codex, ctx));
  }
  if (snapshot.claude) {
    lines.push('', ...formatClaudeSection(snapshot.claude, ctx));
  }
  return lines;
}

/** Codex usage section. */
export function formatCodexSection(codex, ctx = {}) {
  const lines = [providerHeader('Codex usage'), ''];

  if (!codex.enabled) {
    lines.push('Disabled');
    return lines;
  }

  if (codex.credentialsPath) {
    lines.push(`Codex CLI credential path: ${codex.credentialsPath}`);
    lines.push('');
  }

  if (codex.usageSnapshots.length === 0) {
    if (codex.filteredOut) {
      lines.push(`No Codex account matches account filter "${codex.accountFilter}".`);
    } else {
      lines.push('No Codex OAuth profile found.');
    }
    return lines;
  }

  const useBox = codex.usageSnapshots.length > 1;
  for (let i = 0; i < codex.usageSnapshots.length; i++) {
    const snapshot = codex.usageSnapshots[i];
    if (i > 0) lines.push(''); // 박스 사이 1 줄 gap

    const label = accountLabel('openai-codex', snapshot.account);
    const body = [];
    body.push(`  Status: ${snapshot.status.ok ? `OK (${snapshot.status.httpStatus})` : 'FAILED'}`);
    if (snapshot.account.plan) body.push(`  Plan: ${snapshot.account.plan}`);
    for (const window of snapshot.usageWindows) {
      body.push('');
      for (const blockLine of formatWindowBlock(window, ctx)) {
        body.push(`  ${blockLine}`);
      }
    }
    if (snapshot.status.message) body.push(`  Error: ${trimErrorMessage(snapshot.status.message)}`);

    if (useBox) {
      lines.push(...wrapInBox(label, body));
    } else {
      lines.push(`- ${label}`);
      lines.push(...body);
    }
  }
  return lines;
}

/** Claude usage section. */
export function formatClaudeSection(claude, ctx = {}) {
  const lines = [providerHeader('Claude usage'), ''];

  const usageSnapshots = Array.isArray(claude.usageSnapshots) ? claude.usageSnapshots : [];
  lines.push(
    ...formatClaudeNetworkUsages(usageSnapshots, {
      filteredOut: claude.filteredOut,
      accountFilter: claude.accountFilter,
      useColor: ctx.useColor,
      now: ctx.now,
    }),
  );
  return lines;
}

/**
 * Claude live network usage 블록(들).
 *
 * v0.5.0 (issue #120): 인자 `usageSnapshots` 는 UsageSnapshot 객체 배열 — 이전
 * `{ accountKey, account, snapshot }` wrapper 가 unwrap 되어 codex 와 동일.
 * 각 element 는 `buildUsageSnapshot` 결과 (status / usageWindows / provider /
 * account 등).
 */
export function formatClaudeNetworkUsages(usageSnapshots, context = {}) {
  const lines = [];
  if (!usageSnapshots || usageSnapshots.length === 0) {
    if (context.filteredOut) {
      lines.push(`No Claude account matches account filter "${context.accountFilter}".`);
    } else {
      lines.push('Skipped (Claude disabled or no token)');
    }
    return lines;
  }

  const useBox = usageSnapshots.length > 1;
  for (let i = 0; i < usageSnapshots.length; i++) {
    const snapshot = usageSnapshots[i];
    if (useBox) {
      if (i > 0) lines.push(''); // 박스 사이 1 줄 gap
      const header = accountLabel('anthropic-claude', snapshot.account);
      const body = formatClaudeNetworkUsageBody(snapshot, true, context);
      lines.push(...wrapInBox(header, body, '', '  '));
    } else {
      lines.push(...formatClaudeNetworkUsageBody(snapshot, false, context));
    }
  }
  return lines;
}

/**
 * 단일 Claude network usage snapshot 출력.
 *
 * `indented=true` 일 때 prefix `'  '` — wrapInBox 가 box vertical `│ ` 로
 * 치환할 leading indent. `indented=false` 일 때 prefix `''` — 단일 계정
 * 케이스로 top-level 출력.
 */
export function formatClaudeNetworkUsageBody(networkUsage, indented = false, ctx = {}) {
  const prefix = indented ? '  ' : '';
  const lines = [];
  if (!networkUsage) {
    lines.push(`${prefix}Skipped`);
    return lines;
  }

  if (networkUsage.status?.ok) {
    lines.push(`${prefix}Status: OK (${networkUsage.status.httpStatus})`);
    if (networkUsage.usageWindows.length === 0) {
      lines.push(`${prefix}No usageWindows (expected fields missing in response)`);
    }
    for (const window of networkUsage.usageWindows) {
      lines.push(`${prefix}`);
      for (const blockLine of formatWindowBlock(window, ctx)) {
        lines.push(`${prefix}${blockLine}`);
      }
    }
    return lines;
  }

  lines.push(`${prefix}Status: FAILED`);
  if (networkUsage.status?.message) {
    lines.push(`${prefix}Message: ${trimErrorMessage(networkUsage.status.message)}`);
  }
  return lines;
}

/**
 * window 한 개를 3 줄 block 으로 — claude-code `/usage` 스타일.
 *
 * 예시:
 *   Current session (5h)
 *   ██▌░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  5% used
 *   Resets 2pm (Asia/Seoul)
 *
 * issue #116: `used_percent=N, reset_at=...` 단일 라인 형식의 기존 formatWindow
 * 를 완전 대체. 평문은 stable contract 아님 (docs/cli-json-output.md).
 *
 * @param {object} window
 * @param {{ useColor?: boolean, now?: Date }} [ctx]
 * @returns {string[]} 3 줄 — label / bar+pct / reset
 */
export function formatWindowBlock(window, ctx = {}) {
  const label = formatWindowLabel(window);
  const bar = formatProgressBar(window.usedPercent, {
    width: BAR_WIDTH,
    useColor: ctx.useColor ?? false,
  });
  const pctText =
    window.usedPercent == null || Number.isNaN(window.usedPercent)
      ? ' --'
      : `${Math.round(window.usedPercent)}`.padStart(3);
  const barLine = `${bar} ${pctText}% used`;
  const resetLine = `Resets ${formatResetTime(window.resetAt, ctx.now ?? new Date())}`;
  return [label, barLine, resetLine];
}
