/**
 * `telegram uninstall-service` 서브명령 — OS service 자동 등록 (issue #138) 의
 * 대칭 명령. setup 의 자동 등록으로 작성된 systemd unit / launchd plist / Task
 * Scheduler 항목을 confirm 후 제거.
 *
 * 책임 범위 (issue #138 결정): service 파일 + linger 까지만. config / auth.json
 * 은 건드리지 않음 — 봇 설정 자체를 지우려면 사용자가 명시적으로 config 편집.
 */

import { createInterface } from 'node:readline';

import { uninstallOsService, parseYesNo } from './os-service-installer.js';

/**
 * @typedef {object} UninstallOptions
 * @property {(question: string, defaultYes?: boolean) => Promise<boolean>} [confirmFn]
 * @property {(question: string) => Promise<string>} [promptFn]
 * @property {(cmd: string, args: string[]) => string} [execImpl]
 * @property {object} [fsImpl]
 * @property {{ HOME?: string, USER?: string }} [env]
 * @property {NodeJS.Platform} [platform]
 * @property {(msg: string) => void} [log]
 * @property {(msg: string) => void} [errorLog]
 * @property {(opts: object) => Promise<object>} [uninstaller]  - 테스트 mock.
 */

/**
 * @param {string[]} args
 * @param {object} _deps  - 현재 사용 안 함 (대칭성을 위해 유지).
 * @param {UninstallOptions} [options]
 */
export async function runUninstallServiceSubcommand(args, _deps, options = {}) {
  const log = options.log ?? ((msg) => console.log(msg));
  const errorLog = options.errorLog ?? ((msg) => console.error(msg));
  if (Array.isArray(args) && (args.includes('--help') || args.includes('-h'))) {
    for (const line of formatTelegramUninstallServiceHelp()) log(line);
    return;
  }

  const uninstaller = options.uninstaller ?? uninstallOsService;
  // confirmFn 미주입 시 readline 기반 default (Y default — uninstall-service 명령
  // 입력 시점에 의도 명확).
  const confirmFn = options.confirmFn ?? createReadlineConfirm(options.promptFn);

  log('▶ token-weather telegram uninstall-service');
  log('');

  const result = await uninstaller({
    fsImpl: options.fsImpl,
    execImpl: options.execImpl,
    confirmFn,
    log,
    errorLog,
    env: options.env ?? process.env,
    platform: options.platform,
  });

  if (result.status === 'installed') {
    // uninstaller 의 'installed' 는 "정상 완료" 의미 (시퀀스 성공).
    log(`✓ ${result.message}`);
    for (const step of result.steps ?? []) log(`  · ${step}`);
  } else if (result.status === 'skipped') {
    log(`ℹ ${result.message}`);
  } else {
    errorLog(`✗ ${result.message}`);
    if (result.error) errorLog(`  ${result.error}`);
    process.exitCode = 1;
  }
}

function createReadlineConfirm(promptFn) {
  const prompt = promptFn ?? defaultPromptFn;
  return async (question, defaultYes) => {
    const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
    const answer = await prompt(`${question}${suffix}`);
    return parseYesNo(answer, Boolean(defaultYes));
  };
}

function defaultPromptFn(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * `--help` 출력.
 */
export function formatTelegramUninstallServiceHelp() {
  return [
    'token-weather telegram uninstall-service',
    '',
    '`telegram setup` 의 자동 등록으로 작성된 OS service 항목을 제거합니다.',
    '',
    'Options:',
    '  -h, --help   이 도움말 출력',
    '',
    '제거 대상 (issue #138):',
    '  - Linux:   ~/.config/systemd/user/token-weather-bot.service + linger 해제',
    '  - macOS:   ~/Library/LaunchAgents/com.token-weather.bot.plist',
    '  - Windows: schtasks /TN TokenWeatherBot',
    '',
    '주의:',
    '  - config / auth.json 은 건드리지 않습니다. 봇 설정 자체를 지우려면',
    '    `~/.config/token-weather/config.json` 의 channels.telegram 을 수동 편집.',
    '  - Linux 의 linger 해제는 동일 사용자의 다른 user-level service 에도 영향',
    '    이 있을 수 있습니다.',
  ];
}
