/**
 * OS service 자동 등록 / 해제 — `telegram setup` 의 동의 프롬프트 + 별도
 * `telegram uninstall-service` 명령이 호출.
 *
 * Phase 4 (#129) 의 OS service template print only 정책을 동의 기반 자동 등록
 * 으로 확장 (issue #138). 보안 도구 원칙 유지 — 동의 프롬프트 default Y 지만
 * 사용자가 명시 n 시 즉시 skip + 수동 안내 fallback.
 *
 * 모든 외부 의존성 (fs / exec / confirm / log / env / platform) 주입 가능 —
 * 단위 테스트 친화.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { linuxSystemdUnit, macosLaunchAgent } from './os-service-templates.js';
// Windows installer 는 schtasks 명령을 직접 박으므로 windowsTaskScheduler template
// 이 필요 없음 (template 의 instructions 는 manual fallback 용도로 setup-
// subcommand 가 사용).

const SYSTEMD_USER_DIR = '.config/systemd/user';
const LAUNCH_AGENTS_DIR = 'Library/LaunchAgents';

/**
 * @typedef {object} InstallerInput
 * @property {string} nodeBinPath
 * @property {string} cliScriptPath
 * @property {string} [homeDir]
 */

/**
 * @typedef {object} InstallerOptions
 * @property {{ existsSync: Function, readFileSync: Function, writeFileSync: Function,
 *   mkdirSync: Function, unlinkSync: Function }} [fsImpl]
 * @property {(cmd: string, args: string[]) => string} [execImpl]
 * @property {(question: string, defaultYes?: boolean) => Promise<boolean>} [confirmFn]
 * @property {(msg: string) => void} [log]
 * @property {(msg: string) => void} [errorLog]
 * @property {{ HOME?: string, USER?: string }} [env]
 * @property {NodeJS.Platform} [platform]
 */

/**
 * @typedef {object} InstallResult
 * @property {'installed' | 'skipped' | 'failed'} status
 * @property {string} message
 * @property {string[]} [steps]
 * @property {string} [error]
 */

/**
 * OS detect 후 적절한 installer 호출. 지원하지 않는 platform 은 skipped.
 *
 * @param {InstallerInput} input
 * @param {InstallerOptions} [options]
 * @returns {Promise<InstallResult>}
 */
export async function installOsService(input, options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform === 'linux') return installSystemdUnit(input, options);
  if (platform === 'darwin') return installLaunchAgent(input, options);
  if (platform === 'win32') return installTaskScheduler(input, options);
  return {
    status: 'skipped',
    message: `지원하지 않는 platform (${platform}) — 수동 등록만 가능`,
  };
}

/**
 * OS detect 후 적절한 uninstaller 호출.
 *
 * @param {InstallerOptions} [options]
 * @returns {Promise<InstallResult>}
 */
export async function uninstallOsService(options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform === 'linux') return uninstallSystemdUnit(options);
  if (platform === 'darwin') return uninstallLaunchAgent(options);
  if (platform === 'win32') return uninstallTaskScheduler(options);
  return {
    status: 'skipped',
    message: `지원하지 않는 platform (${platform}) — 수동 제거만 가능`,
  };
}

// ─── Linux systemd ──────────────────────────────────────────────────────────

export async function installSystemdUnit(input, options = {}) {
  const fsImpl = options.fsImpl ?? fs;
  const execImpl = options.execImpl ?? defaultExecImpl;
  const confirmFn = options.confirmFn ?? defaultConfirmFn;
  const log = options.log ?? ((msg) => console.log(msg));
  const env = options.env ?? process.env;
  const home = input.homeDir ?? env.HOME;
  const user = env.USER ?? '';

  // 1) systemd 존재 검사.
  try {
    execImpl('systemctl', ['--version']);
  } catch (err) {
    return {
      status: 'skipped',
      message: `systemd 미감지 (${err?.message ?? 'systemctl 실행 실패'}) — 수동 등록 안내로 fallback`,
    };
  }

  const tmpl = linuxSystemdUnit({
    nodeBinPath: input.nodeBinPath,
    cliScriptPath: input.cliScriptPath,
  });
  const serviceDir = path.join(home, SYSTEMD_USER_DIR);
  const servicePath = path.join(serviceDir, tmpl.serviceFilename);

  // 2) 기존 파일 충돌 검사.
  if (fsImpl.existsSync(servicePath)) {
    const existing = fsImpl.readFileSync(servicePath, 'utf8');
    if (existing.trim() !== tmpl.content.trim()) {
      const overwrite = await confirmFn(
        `기존 service 파일과 내용이 다릅니다: ${servicePath}\n덮어쓸까요?`,
        false,
      );
      if (!overwrite) {
        return {
          status: 'skipped',
          message: `사용자가 덮어쓰기 거부 — ${servicePath} 보존`,
        };
      }
    }
  }

  // 3) install 시퀀스.
  const steps = [];
  try {
    fsImpl.mkdirSync(serviceDir, { recursive: true });
    steps.push(`mkdir -p ${serviceDir}`);
    fsImpl.writeFileSync(servicePath, `${tmpl.content}\n`);
    steps.push(`write ${servicePath}`);
    execImpl('systemctl', ['--user', 'daemon-reload']);
    steps.push('systemctl --user daemon-reload');
    execImpl('systemctl', ['--user', 'enable', '--now', tmpl.serviceFilename]);
    steps.push(`systemctl --user enable --now ${tmpl.serviceFilename}`);
    // linger — 실패해도 warning + 계속 (loginctl 부재 가능 환경).
    try {
      execImpl('loginctl', ['enable-linger', user]);
      steps.push(`loginctl enable-linger ${user}`);
    } catch (err) {
      log(`⚠ loginctl enable-linger 실패 (계속 진행): ${err?.message ?? err}`);
    }
    return {
      status: 'installed',
      message: `systemd --user service 등록 완료. Node 버전 매니저 변경 시 \`telegram setup\` 재실행 권장.`,
      steps,
    };
  } catch (err) {
    // cleanup — 작성한 파일 삭제 + disable 시도.
    if (fsImpl.existsSync(servicePath)) {
      try {
        fsImpl.unlinkSync(servicePath);
      } catch {
        // ignore
      }
    }
    return {
      status: 'failed',
      message: `systemd install 실패 (cleanup 후) — 수동 등록 안내로 fallback`,
      error: err?.message ?? String(err),
      steps,
    };
  }
}

export async function uninstallSystemdUnit(options = {}) {
  const fsImpl = options.fsImpl ?? fs;
  const execImpl = options.execImpl ?? defaultExecImpl;
  const confirmFn = options.confirmFn ?? defaultConfirmFn;
  const log = options.log ?? ((msg) => console.log(msg));
  const env = options.env ?? process.env;
  const home = env.HOME ?? '';
  const user = env.USER ?? '';

  const serviceFilename = 'token-weather-bot.service';
  const servicePath = path.join(home, SYSTEMD_USER_DIR, serviceFilename);

  if (!fsImpl.existsSync(servicePath)) {
    return {
      status: 'skipped',
      message: `service 파일 없음: ${servicePath} — 이미 제거되었거나 자동 설치된 적 없음`,
    };
  }

  const ok = await confirmFn(
    `다음을 제거합니다:\n  - ${servicePath}\n  - systemctl --user disable --now ${serviceFilename}\n  - loginctl disable-linger ${user} (다른 user-level service 도 영향)\n계속?`,
    true,
  );
  if (!ok) return { status: 'skipped', message: '사용자가 제거 거부' };

  const steps = [];
  try {
    execImpl('systemctl', ['--user', 'disable', '--now', serviceFilename]);
    steps.push(`systemctl --user disable --now ${serviceFilename}`);
    fsImpl.unlinkSync(servicePath);
    steps.push(`unlink ${servicePath}`);
    try {
      execImpl('loginctl', ['disable-linger', user]);
      steps.push(`loginctl disable-linger ${user}`);
    } catch (err) {
      log(`⚠ loginctl disable-linger 실패 (계속 진행): ${err?.message ?? err}`);
    }
    return { status: 'installed', message: 'systemd service 제거 완료', steps };
  } catch (err) {
    return {
      status: 'failed',
      message: '제거 중 일부 단계 실패',
      error: err?.message ?? String(err),
      steps,
    };
  }
}

// ─── macOS launchd ──────────────────────────────────────────────────────────

export async function installLaunchAgent(input, options = {}) {
  const fsImpl = options.fsImpl ?? fs;
  const execImpl = options.execImpl ?? defaultExecImpl;
  const confirmFn = options.confirmFn ?? defaultConfirmFn;
  const env = options.env ?? process.env;
  const home = input.homeDir ?? env.HOME;

  try {
    execImpl('launchctl', ['version']);
  } catch (err) {
    return {
      status: 'skipped',
      message: `launchctl 미감지 (${err?.message ?? '실행 실패'}) — 수동 등록 안내로 fallback`,
    };
  }

  const tmpl = macosLaunchAgent({ ...input, homeDir: home });
  const agentsDir = path.join(home, LAUNCH_AGENTS_DIR);
  const plistPath = path.join(agentsDir, tmpl.serviceFilename);

  if (fsImpl.existsSync(plistPath)) {
    const existing = fsImpl.readFileSync(plistPath, 'utf8');
    if (existing.trim() !== tmpl.content.trim()) {
      const overwrite = await confirmFn(
        `기존 LaunchAgent plist 와 내용이 다릅니다: ${plistPath}\n덮어쓸까요?`,
        false,
      );
      if (!overwrite) {
        return { status: 'skipped', message: `사용자가 덮어쓰기 거부 — ${plistPath} 보존` };
      }
    }
  }

  const steps = [];
  try {
    fsImpl.mkdirSync(agentsDir, { recursive: true });
    steps.push(`mkdir -p ${agentsDir}`);
    fsImpl.writeFileSync(plistPath, `${tmpl.content}\n`);
    steps.push(`write ${plistPath}`);
    const uid = execImpl('id', ['-u']).trim();
    execImpl('launchctl', ['bootstrap', `gui/${uid}`, plistPath]);
    steps.push(`launchctl bootstrap gui/${uid} ${plistPath}`);
    return {
      status: 'installed',
      message: 'LaunchAgent 등록 완료. Node 버전 매니저 변경 시 `telegram setup` 재실행 권장.',
      steps,
    };
  } catch (err) {
    if (fsImpl.existsSync(plistPath)) {
      try {
        fsImpl.unlinkSync(plistPath);
      } catch {
        // ignore
      }
    }
    return {
      status: 'failed',
      message: 'launchd install 실패 (cleanup 후) — 수동 등록 안내로 fallback',
      error: err?.message ?? String(err),
      steps,
    };
  }
}

export async function uninstallLaunchAgent(options = {}) {
  const fsImpl = options.fsImpl ?? fs;
  const execImpl = options.execImpl ?? defaultExecImpl;
  const confirmFn = options.confirmFn ?? defaultConfirmFn;
  const env = options.env ?? process.env;
  const home = env.HOME ?? '';

  const serviceFilename = 'com.token-weather.bot.plist';
  const plistPath = path.join(home, LAUNCH_AGENTS_DIR, serviceFilename);

  if (!fsImpl.existsSync(plistPath)) {
    return {
      status: 'skipped',
      message: `plist 파일 없음: ${plistPath} — 이미 제거되었거나 자동 설치된 적 없음`,
    };
  }

  const ok = await confirmFn(
    `다음을 제거합니다:\n  - launchctl bootout gui/$(id -u) ${plistPath}\n  - unlink ${plistPath}\n계속?`,
    true,
  );
  if (!ok) return { status: 'skipped', message: '사용자가 제거 거부' };

  const steps = [];
  try {
    const uid = execImpl('id', ['-u']).trim();
    execImpl('launchctl', ['bootout', `gui/${uid}`, plistPath]);
    steps.push(`launchctl bootout gui/${uid} ${plistPath}`);
    fsImpl.unlinkSync(plistPath);
    steps.push(`unlink ${plistPath}`);
    return { status: 'installed', message: 'LaunchAgent 제거 완료', steps };
  } catch (err) {
    return {
      status: 'failed',
      message: '제거 중 일부 단계 실패',
      error: err?.message ?? String(err),
      steps,
    };
  }
}

// ─── Windows Task Scheduler ─────────────────────────────────────────────────

export async function installTaskScheduler(input, options = {}) {
  const execImpl = options.execImpl ?? defaultExecImpl;
  const confirmFn = options.confirmFn ?? defaultConfirmFn;

  try {
    execImpl('schtasks', ['/?']);
  } catch (err) {
    return {
      status: 'skipped',
      message: `schtasks 미감지 (${err?.message ?? '실행 실패'}) — 수동 등록 안내로 fallback`,
    };
  }

  // 기존 task 충돌 검사 — `/Query` 성공 시 동일 이름 task 존재 (PR #140 review
  // blocker 2). systemd / launchd 와 일관된 사용자 파일 보호 정책.
  let existing = false;
  try {
    execImpl('schtasks', ['/Query', '/TN', 'TokenWeatherBot']);
    existing = true;
  } catch {
    // task 없음 — 정상 진행.
  }
  if (existing) {
    const overwrite = await confirmFn(
      '기존 Task Scheduler 항목 `TokenWeatherBot` 가 존재합니다. 덮어쓸까요?',
      false,
    );
    if (!overwrite) {
      return {
        status: 'skipped',
        message: '사용자가 덮어쓰기 거부 — 기존 TokenWeatherBot task 보존',
      };
    }
  }

  const steps = [];
  try {
    const taskRun = `"${input.nodeBinPath}" "${input.cliScriptPath}" telegram start`;
    execImpl('schtasks', [
      '/Create',
      '/TN',
      'TokenWeatherBot',
      '/SC',
      'ONLOGON',
      '/RL',
      'LIMITED',
      '/TR',
      taskRun,
      '/F',
    ]);
    steps.push('schtasks /Create /TN TokenWeatherBot ...');
    return {
      status: 'installed',
      message:
        'Windows Task Scheduler 등록 완료. Node 버전 매니저 변경 시 `telegram setup` 재실행 권장.',
      steps,
    };
  } catch (err) {
    return {
      status: 'failed',
      message: 'taskscheduler install 실패 — 수동 등록 안내로 fallback',
      error: err?.message ?? String(err),
      steps,
    };
  }
}

export async function uninstallTaskScheduler(options = {}) {
  const execImpl = options.execImpl ?? defaultExecImpl;
  const confirmFn = options.confirmFn ?? defaultConfirmFn;

  const ok = await confirmFn(
    `다음을 제거합니다:\n  - schtasks /Delete /TN TokenWeatherBot /F\n계속?`,
    true,
  );
  if (!ok) return { status: 'skipped', message: '사용자가 제거 거부' };

  const steps = [];
  try {
    execImpl('schtasks', ['/Delete', '/TN', 'TokenWeatherBot', '/F']);
    steps.push('schtasks /Delete /TN TokenWeatherBot /F');
    return { status: 'installed', message: 'Task Scheduler 항목 제거 완료', steps };
  } catch (err) {
    return {
      status: 'failed',
      message: '제거 실패 (이미 없거나 권한 문제)',
      error: err?.message ?? String(err),
      steps,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function defaultExecImpl(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

async function defaultConfirmFn(_question, defaultYes) {
  // 기본 구현은 default 값 반환 — 실제 prompt 가 필요하면 호출자가 옵션 주입.
  return Boolean(defaultYes);
}

/**
 * Y/N 응답 파싱 — 빈 입력 시 default 적용. setup / uninstall-service 의 공통
 * helper.
 *
 * @param {string} answer
 * @param {boolean} defaultYes
 * @returns {boolean}
 */
export function parseYesNo(answer, defaultYes) {
  const trimmed = (answer ?? '').trim().toLowerCase();
  if (trimmed === '') return defaultYes;
  if (/^y(es)?$/.test(trimmed)) return true;
  if (/^n(o)?$/.test(trimmed)) return false;
  return defaultYes;
}
