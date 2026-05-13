/**
 * `telegram check` 서브명령 — read-only 진단.
 *
 * Phase 4 (#129) 의 보조 명령. 시스템 파일을 만들지 않고, 다음 항목을 검사해
 * 친화 출력으로 사용자에게 상태 안내:
 *
 *   1) config 파일 존재 / 권한 (chmod 600 권장).
 *   2) channels.telegram.enabled / botToken / allowedUserIds 채워짐.
 *   3) getMe API 로 botToken 유효성.
 *   4) Linux: `loginctl show-user $USER --property=Linger` 가 yes 인지
 *      (linger 비활성화면 로그아웃 시 daemon 종료 경고).
 *
 * 본 명령은 부수효과 없음 — 파일 / 네트워크 (POST) 변경 X. getMe (GET) 만.
 */

import fs from 'node:fs';
import { execSync } from 'node:child_process';

import { validateBotToken } from './pairing.js';

/**
 * @typedef {object} CheckOptions
 * @property {typeof fetch} [fetchFn]
 * @property {(msg: string) => void} [log]
 * @property {{ statSync: Function, existsSync: Function, readFileSync: Function }} [fsImpl]
 * @property {(cmd: string) => string} [execImpl] - linger 검사용 execSync wrapper.
 * @property {NodeJS.Platform} [platform] - process.platform override (테스트 용).
 */

/**
 * `token-weather telegram check` 의 dispatch 진입점.
 *
 * @param {string[]} args
 * @param {{ resolveAgentConfigPath: () => string }} deps
 * @param {CheckOptions} [options]
 * @returns {Promise<{ checks: Array<{ name: string, ok: boolean | 'warn', message: string }> }>}
 */
export async function runCheckSubcommand(args, deps, options = {}) {
  const log = options.log ?? ((msg) => console.log(msg));
  if (Array.isArray(args) && (args.includes('--help') || args.includes('-h'))) {
    for (const line of formatTelegramCheckHelp()) log(line);
    return { checks: [] };
  }
  if (!deps?.resolveAgentConfigPath) {
    throw new Error('runCheckSubcommand: deps.resolveAgentConfigPath 가 필요합니다.');
  }
  const fsImpl = options.fsImpl ?? fs;
  const platform = options.platform ?? process.platform;
  const fetchFn = options.fetchFn ?? fetch;
  const execImpl = options.execImpl ?? ((cmd) => execSync(cmd).toString());

  const configPath = deps.resolveAgentConfigPath();
  const checks = [];

  // 1) config 존재.
  if (!fsImpl.existsSync(configPath)) {
    checks.push({
      name: 'config 파일',
      ok: false,
      message: `없음 — ${configPath}. \`token-weather telegram setup\` 으로 생성.`,
    });
    printChecks(log, checks);
    process.exitCode = 1;
    return { checks };
  }
  checks.push({ name: 'config 파일', ok: true, message: configPath });

  // 2) chmod 권한.
  try {
    const stat = fsImpl.statSync(configPath);
    const worldOrGroupBits = stat.mode & 0o077;
    if (worldOrGroupBits !== 0) {
      checks.push({
        name: 'config 권한',
        ok: 'warn',
        message: `mode=${(stat.mode & 0o777).toString(8).padStart(3, '0')} — group/world 비트 노출. chmod 600 권장.`,
      });
    } else {
      checks.push({ name: 'config 권한', ok: true, message: 'chmod 600 (group/world 차단)' });
    }
  } catch (err) {
    checks.push({ name: 'config 권한', ok: false, message: `stat 실패: ${err?.message ?? err}` });
  }

  // 3) channels.telegram 키 검증.
  let config;
  try {
    config = JSON.parse(fsImpl.readFileSync(configPath, 'utf8'));
  } catch (err) {
    checks.push({ name: 'config JSON', ok: false, message: `parse 실패: ${err?.message ?? err}` });
    printChecks(log, checks);
    process.exitCode = 1;
    return { checks };
  }
  const tg = config?.channels?.telegram;
  if (!tg) {
    checks.push({
      name: 'channels.telegram',
      ok: false,
      message: '키 없음 — setup 미완료.',
    });
    printChecks(log, checks);
    process.exitCode = 1;
    return { checks };
  }
  checks.push({
    name: 'channels.telegram.enabled',
    ok: Boolean(tg.enabled),
    message: tg.enabled ? 'true' : 'false (setup 미완료 또는 비활성화)',
  });
  checks.push({
    name: 'channels.telegram.botToken',
    ok: Boolean(tg.botToken),
    message: tg.botToken ? '비어 있지 않음' : '비어 있음',
  });
  const allowedCount = Array.isArray(tg.allowedUserIds) ? tg.allowedUserIds.length : 0;
  checks.push({
    name: 'channels.telegram.allowedUserIds',
    ok: allowedCount > 0,
    message: `${allowedCount} 개`,
  });

  // 4) getMe 로 botToken 유효성.
  if (tg.botToken) {
    const validation = await validateBotToken(tg.botToken, { fetchFn });
    checks.push({
      name: 'getMe API',
      ok: validation.ok,
      message: validation.ok ? `@${validation.botInfo?.username ?? '(unknown)'}` : validation.error,
    });
  }

  // 5) Linux: linger 상태.
  if (platform === 'linux') {
    try {
      const user = process.env.USER ?? '';
      const out = execImpl(`loginctl show-user "${user}" --property=Linger`);
      const linger = /Linger=yes/.test(out);
      checks.push({
        name: 'systemd linger',
        ok: linger ? true : 'warn',
        message: linger
          ? '활성화 (로그아웃 후에도 daemon 유지)'
          : '비활성화 — `loginctl enable-linger "$USER"` 권장',
      });
    } catch {
      // loginctl 미사용 환경 (alpine init / docker / WSL 일부) 은 정보 결여로 skip.
    }
  }

  printChecks(log, checks);
  if (checks.some((c) => c.ok === false)) {
    process.exitCode = 1;
  }
  return { checks };
}

function printChecks(log, checks) {
  log('▶ token-weather telegram check');
  log('');
  for (const c of checks) {
    const icon = c.ok === true ? '✓' : c.ok === 'warn' ? '⚠' : '✗';
    log(`  ${icon} ${c.name}: ${c.message}`);
  }
}

/**
 * `token-weather telegram check --help` 출력. Pure function.
 */
export function formatTelegramCheckHelp() {
  return [
    'token-weather telegram check',
    '',
    'Telegram 봇 설정 / token / linger 상태를 read-only 진단합니다.',
    '',
    'Options:',
    '  -h, --help   이 도움말 출력',
    '',
    '검사 항목:',
    '  - config 파일 존재 / chmod 권한',
    '  - channels.telegram.enabled / botToken / allowedUserIds 채워짐',
    '  - Telegram Bot API getMe 로 botToken 유효성 (네트워크)',
    '  - Linux 한정: systemd linger 활성화 (로그아웃 후 daemon 유지)',
  ];
}
