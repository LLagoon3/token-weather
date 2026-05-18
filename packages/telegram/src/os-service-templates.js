/**
 * OS 별 service unit / plist / task scheduler 템플릿 — `telegram setup` 의 print
 * 대상.
 *
 * Phase 4 (#129) 의 UX 절충안 — 도구가 시스템 파일을 직접 작성하지 않고 사용자가
 * 복사 / 붙여넣기로 활성화 가능한 명령 블록을 print 만 한다. 자동 등록은
 * 후속 plan 의 `--auto-register` 플래그 (out of scope) 로 확장 여지.
 *
 * 본 모듈의 모든 함수는 pure — 절대 경로 / 명령 문자열만 가공한다. 파일 시스템
 * 변경 없음.
 *
 * issue #141: 경로에 공백 / XML 특수문자가 포함되어도 자동 등록이 통과하도록
 * `os-service-path-escape` helper 를 통해 OS 별 정확한 quoting / escape 를 적용.
 * 이전에는 `installer` 가 사전 검사로 skip 했으나, 본 patch 로 Windows 표준 Node
 * 설치 환경 (`C:\Program Files\nodejs\node.exe`) 도 자동 등록 가능.
 */

import { escapeSystemdArg, escapePlistXml, escapeSchtasksArg } from './os-service-path-escape.js';

/**
 * @typedef {object} ServiceTemplate
 * @property {string} kind - 'systemd' | 'launchd' | 'taskscheduler'.
 * @property {string} title - 사람-읽기 제목 ("Linux systemd --user unit" 등).
 * @property {string[]} instructions - 사용자가 그대로 셸에 복사 / 붙여넣기 할 명령
 *   블록. 한 줄에 한 명령 또는 multi-line heredoc.
 */

/**
 * @typedef {object} TemplateInput
 * @property {string} nodeBinPath - daemon 을 실행할 node 바이너리 절대 경로
 *   (`process.execPath`).
 * @property {string} cliScriptPath - `bin/token-weather.js` 절대 경로.
 *   `process.argv[1]` 또는 cli 의 `import.meta.url` 에서 추출. 환경에 따라
 *   nvm/fnm 의 그림자 경로일 수 있으므로 setup 재실행 시 갱신될 수 있음.
 * @property {string} [homeDir] - 사용자 HOME 경로 (logs 위치 등에 사용).
 *   미지정 시 `process.env.HOME`.
 */

/**
 * Linux systemd `--user` unit 템플릿 + 활성화 명령.
 *
 * @param {TemplateInput} input
 * @returns {ServiceTemplate}
 */
export function linuxSystemdUnit({ nodeBinPath, cliScriptPath }) {
  // issue #141: ExecStart 의 nodeBin / cliScript 경로를 systemd 의 double-quote
  // escape 로 wrap → 공백 / 특수문자 포함 경로도 안전.
  const execStart = `${escapeSystemdArg(nodeBinPath)} ${escapeSystemdArg(cliScriptPath)} telegram start`;
  const unitContent = [
    '[Unit]',
    'Description=Token Weather Telegram bot',
    'After=network-online.target',
    '',
    '[Service]',
    `ExecStart=${execStart}`,
    'Restart=on-failure',
    'RestartSec=5s',
    '',
    '[Install]',
    'WantedBy=default.target',
  ].join('\n');
  return {
    kind: 'systemd',
    title: 'Linux systemd --user unit (user-level, sudo 불필요)',
    // installer 가 직접 fs.writeFile 로 작성할 raw unit content + 대상 경로
    // (issue #138). instructions 의 heredoc 안 본문과 동일.
    content: unitContent,
    serviceFilename: 'token-weather-bot.service',
    instructions: [
      'mkdir -p ~/.config/systemd/user',
      "cat > ~/.config/systemd/user/token-weather-bot.service <<'EOF'",
      unitContent,
      'EOF',
      'systemctl --user daemon-reload',
      'systemctl --user enable --now token-weather-bot.service',
      '# 로그아웃 후에도 daemon 이 살아 있게 하려면:',
      'loginctl enable-linger "$USER"',
    ],
  };
}

/**
 * macOS launchd `LaunchAgent` 템플릿 + load 명령.
 *
 * @param {TemplateInput} input
 * @returns {ServiceTemplate}
 */
export function macosLaunchAgent({ nodeBinPath, cliScriptPath, homeDir }) {
  const home = homeDir ?? process.env.HOME ?? '~';
  // issue #141: <string>...</string> 본문은 XML element content — `&` `<` `>` 를
  // entity escape 해야 plist 파서가 깨지지 않음. attribute 가 아니므로 quote 는 무관.
  const plistContent = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"',
    '  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>Label</key>',
    '  <string>com.token-weather.bot</string>',
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    <string>${escapePlistXml(nodeBinPath)}</string>`,
    `    <string>${escapePlistXml(cliScriptPath)}</string>`,
    '    <string>telegram</string>',
    '    <string>start</string>',
    '  </array>',
    '  <key>RunAtLoad</key>',
    '  <true/>',
    '  <key>KeepAlive</key>',
    '  <true/>',
    '  <key>StandardOutPath</key>',
    `  <string>${escapePlistXml(`${home}/Library/Logs/token-weather-bot.log`)}</string>`,
    '  <key>StandardErrorPath</key>',
    `  <string>${escapePlistXml(`${home}/Library/Logs/token-weather-bot-error.log`)}</string>`,
    '</dict>',
    '</plist>',
  ].join('\n');
  return {
    kind: 'launchd',
    title: 'macOS LaunchAgent (user-level, sudo 불필요)',
    content: plistContent,
    serviceFilename: 'com.token-weather.bot.plist',
    instructions: [
      'mkdir -p ~/Library/LaunchAgents',
      "cat > ~/Library/LaunchAgents/com.token-weather.bot.plist <<'EOF'",
      plistContent,
      'EOF',
      'launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.token-weather.bot.plist',
      '# 종료하려면:',
      'launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/com.token-weather.bot.plist',
    ],
  };
}

/**
 * Windows Task Scheduler 등록 명령 (user task — sudo 불필요).
 *
 * @param {TemplateInput} input
 * @returns {ServiceTemplate}
 */
export function windowsTaskScheduler({ nodeBinPath, cliScriptPath }) {
  // issue #141: /TR 는 single string program+args 라 각 인자 path 안 `"` 를
  // `\"` 로 escape, 그 후 `"..."` wrap. escapeSchtasksArg 가 처리.
  const node = escapeSchtasksArg(nodeBinPath);
  const script = escapeSchtasksArg(cliScriptPath);
  return {
    kind: 'taskscheduler',
    title: 'Windows Task Scheduler (user task, 관리자 권한 불필요)',
    instructions: [
      // /TR 의 outer quote 는 cmd.exe 가 받는 경계, 그 안의 escape 된 `"`
      // 는 schtasks 가 prog/args 로 split 할 때 사용.
      `schtasks /Create /TN "TokenWeatherBot" /SC ONLOGON /RL LIMITED /TR "${node} ${script} telegram start"`,
      'rem 종료 / 제거하려면:',
      'schtasks /End /TN "TokenWeatherBot"',
      'schtasks /Delete /TN "TokenWeatherBot" /F',
    ],
  };
}

/**
 * 현재 OS 에 맞는 템플릿을 자동 선택 — `process.platform` detect.
 * 알려지지 않은 OS 면 systemd 를 기본 (linux 가정) 으로 반환.
 *
 * @param {TemplateInput} input
 * @returns {ServiceTemplate}
 */
export function pickServiceTemplate(input) {
  const platform = process.platform;
  if (platform === 'darwin') return macosLaunchAgent(input);
  if (platform === 'win32') return windowsTaskScheduler(input);
  return linuxSystemdUnit(input);
}
