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
 */

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
  const unitContent = [
    '[Unit]',
    'Description=Token Weather Telegram bot',
    'After=network-online.target',
    '',
    '[Service]',
    `ExecStart=${nodeBinPath} ${cliScriptPath} telegram start`,
    'Restart=on-failure',
    'RestartSec=5s',
    '',
    '[Install]',
    'WantedBy=default.target',
  ].join('\n');
  return {
    kind: 'systemd',
    title: 'Linux systemd --user unit (user-level, sudo 불필요)',
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
    `    <string>${nodeBinPath}</string>`,
    `    <string>${cliScriptPath}</string>`,
    '    <string>telegram</string>',
    '    <string>start</string>',
    '  </array>',
    '  <key>RunAtLoad</key>',
    '  <true/>',
    '  <key>KeepAlive</key>',
    '  <true/>',
    '  <key>StandardOutPath</key>',
    `  <string>${home}/Library/Logs/token-weather-bot.log</string>`,
    '  <key>StandardErrorPath</key>',
    `  <string>${home}/Library/Logs/token-weather-bot-error.log</string>`,
    '</dict>',
    '</plist>',
  ].join('\n');
  return {
    kind: 'launchd',
    title: 'macOS LaunchAgent (user-level, sudo 불필요)',
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
  return {
    kind: 'taskscheduler',
    title: 'Windows Task Scheduler (user task, 관리자 권한 불필요)',
    instructions: [
      // cmd.exe 의 escape 규칙 — 경로에 공백 시 따옴표 필수.
      'schtasks /Create /TN "TokenWeatherBot" /SC ONLOGON /RL LIMITED ' +
        `/TR "\\"${nodeBinPath}\\" \\"${cliScriptPath}\\" telegram start"`,
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
