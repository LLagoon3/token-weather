import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  linuxSystemdUnit,
  macosLaunchAgent,
  windowsTaskScheduler,
  pickServiceTemplate,
} from '../src/os-service-templates.js';

const INPUT = {
  nodeBinPath: '/usr/bin/node',
  cliScriptPath:
    '/home/u/.nvm/versions/node/v20/lib/node_modules/@token-weather/cli/bin/token-weather.js',
  homeDir: '/Users/u',
};

describe('linuxSystemdUnit (Phase 4)', () => {
  const tmpl = linuxSystemdUnit(INPUT);

  it('kind / title 정확', () => {
    assert.equal(tmpl.kind, 'systemd');
    assert.match(tmpl.title, /systemd/);
  });

  it('mkdir + cat heredoc + systemctl 활성화 명령 모두 포함', () => {
    const text = tmpl.instructions.join('\n');
    assert.match(text, /mkdir -p ~\/\.config\/systemd\/user/);
    assert.match(text, /token-weather-bot\.service/);
    assert.match(text, /systemctl --user daemon-reload/);
    assert.match(text, /systemctl --user enable --now/);
    assert.match(text, /loginctl enable-linger/);
  });

  it('ExecStart 에 nodeBinPath + cliScriptPath + "telegram start" 포함 (issue #141: double-quote wrap)', () => {
    const text = tmpl.instructions.join('\n');
    assert.match(text, /ExecStart="\/usr\/bin\/node" .* telegram start/);
    assert.ok(text.includes(`"${INPUT.cliScriptPath}"`));
  });

  it('공백 포함 경로도 자동 등록 가능 — issue #141', () => {
    const t = linuxSystemdUnit({
      nodeBinPath: '/path with space/node',
      cliScriptPath: '/cli with space/token-weather.js',
    });
    const text = t.instructions.join('\n');
    assert.match(
      text,
      /ExecStart="\/path with space\/node" "\/cli with space\/token-weather\.js" telegram start/,
    );
  });
});

describe('macosLaunchAgent (Phase 4)', () => {
  const tmpl = macosLaunchAgent(INPUT);

  it('kind / title 정확', () => {
    assert.equal(tmpl.kind, 'launchd');
    assert.match(tmpl.title, /LaunchAgent/);
  });

  it('plist 의 ProgramArguments + RunAtLoad + KeepAlive 포함', () => {
    const text = tmpl.instructions.join('\n');
    assert.match(text, /com\.token-weather\.bot/);
    assert.match(text, /<key>RunAtLoad<\/key>/);
    assert.match(text, /<key>KeepAlive<\/key>/);
    // alphanumeric 경로는 XML escape 영향 없음.
    assert.ok(text.includes(`<string>${INPUT.nodeBinPath}</string>`));
    assert.ok(text.includes(`<string>${INPUT.cliScriptPath}</string>`));
  });

  it('XML 특수문자 (& < >) 포함 경로도 자동 등록 가능 — issue #141', () => {
    const t = macosLaunchAgent({
      nodeBinPath: '/Users/Q&A/node',
      cliScriptPath: '/cli/<bin>/token-weather.js',
      homeDir: '/Users/u',
    });
    const text = t.instructions.join('\n');
    assert.ok(text.includes('<string>/Users/Q&amp;A/node</string>'));
    assert.ok(text.includes('<string>/cli/&lt;bin&gt;/token-weather.js</string>'));
  });

  it('log path 가 homeDir 기준', () => {
    const text = tmpl.instructions.join('\n');
    assert.ok(text.includes('/Users/u/Library/Logs/token-weather-bot.log'));
  });

  it('launchctl bootstrap 명령 포함', () => {
    const text = tmpl.instructions.join('\n');
    assert.match(text, /launchctl bootstrap "gui\/\$\(id -u\)"/);
  });
});

describe('windowsTaskScheduler (Phase 4)', () => {
  const tmpl = windowsTaskScheduler(INPUT);

  it('kind / title 정확', () => {
    assert.equal(tmpl.kind, 'taskscheduler');
    assert.match(tmpl.title, /Task Scheduler/);
  });

  it('schtasks /Create + ONLOGON + LIMITED 포함', () => {
    const text = tmpl.instructions.join('\n');
    assert.match(text, /schtasks \/Create/);
    assert.match(text, /\/SC ONLOGON/);
    assert.match(text, /\/RL LIMITED/);
    assert.match(text, /telegram start/);
  });

  it('경로 따옴표 escape — cmd.exe 호환', () => {
    const text = tmpl.instructions.join('\n');
    // \\" 로 escape 되어 cmd 가 따옴표 인식.
    assert.match(text, /\\"\/usr\/bin\/node\\"/);
  });

  it('공백 포함 경로 (Windows 표준 Node 설치 환경) 도 자동 등록 가능 — issue #141', () => {
    const t = windowsTaskScheduler({
      nodeBinPath: 'C:\\Program Files\\nodejs\\node.exe',
      cliScriptPath:
        'C:\\Users\\u\\AppData\\Roaming\\npm\\node_modules\\@token-weather\\cli\\bin\\token-weather.js',
    });
    const text = t.instructions.join('\n');
    // /TR "\"C:\Program Files\nodejs\node.exe\" \"...\" telegram start"
    assert.match(text, /\/TR "\\"C:\\Program Files\\nodejs\\node\.exe\\" /);
  });
});

describe('pickServiceTemplate (Phase 4)', () => {
  it('현재 OS 에 맞는 템플릿을 자동 선택', () => {
    const tmpl = pickServiceTemplate(INPUT);
    // 호스트 OS 가 macOS/Linux/Windows 중 어느 것이든 알려진 kind 반환.
    assert.ok(['systemd', 'launchd', 'taskscheduler'].includes(tmpl.kind));
  });
});
