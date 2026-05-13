import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  runUninstallServiceSubcommand,
  formatTelegramUninstallServiceHelp,
} from '../src/uninstall-service-subcommand.js';

function makeLogger() {
  const logs = [];
  const errors = [];
  return {
    logs,
    errors,
    log: (m) => logs.push(m),
    errorLog: (m) => errors.push(m),
  };
}

describe('runUninstallServiceSubcommand (issue #138)', () => {
  it('--help 안내 출력', async () => {
    const { logs, log } = makeLogger();
    await runUninstallServiceSubcommand(['--help'], null, { log });
    assert.ok(logs.some((l) => l.includes('telegram uninstall-service')));
  });

  it('-h 도 동일 안내', async () => {
    const { logs, log } = makeLogger();
    await runUninstallServiceSubcommand(['-h'], null, { log });
    assert.ok(logs.some((l) => l.includes('제거 대상')));
  });

  it('uninstaller status installed → ✓ 출력 + exit 0', async () => {
    process.exitCode = 0;
    const { logs, log, errorLog } = makeLogger();
    await runUninstallServiceSubcommand([], null, {
      log,
      errorLog,
      uninstaller: async () => ({
        status: 'succeeded',
        message: 'systemd service 제거 완료',
        steps: ['systemctl --user disable', 'unlink ...'],
      }),
    });
    assert.ok(logs.some((l) => l.startsWith('✓')));
    assert.ok(logs.some((l) => l.includes('systemctl --user disable')));
    assert.equal(process.exitCode, 0);
  });

  it('uninstaller status skipped → ℹ 출력 + exit 0', async () => {
    process.exitCode = 0;
    const { logs, log, errorLog } = makeLogger();
    await runUninstallServiceSubcommand([], null, {
      log,
      errorLog,
      uninstaller: async () => ({ status: 'skipped', message: 'service 파일 없음' }),
    });
    assert.ok(logs.some((l) => l.startsWith('ℹ')));
    assert.equal(process.exitCode, 0);
  });

  it('uninstaller status failed → ✗ + exit 1', async () => {
    process.exitCode = 0;
    const { errors, log, errorLog } = makeLogger();
    await runUninstallServiceSubcommand([], null, {
      log,
      errorLog,
      uninstaller: async () => ({
        status: 'failed',
        message: '제거 실패',
        error: 'permission denied',
      }),
    });
    assert.ok(errors.some((e) => e.startsWith('✗')));
    assert.ok(errors.some((e) => e.includes('permission denied')));
    assert.equal(process.exitCode, 1);
    process.exitCode = 0;
  });

  it('confirmFn / promptFn / env / platform 등 옵션이 uninstaller 에 전달됨', async () => {
    let receivedOptions = null;
    const { log, errorLog } = makeLogger();
    await runUninstallServiceSubcommand([], null, {
      log,
      errorLog,
      env: { HOME: '/x', USER: 'u' },
      platform: 'linux',
      uninstaller: async (opts) => {
        receivedOptions = opts;
        return { status: 'skipped', message: 'mock' };
      },
    });
    assert.equal(receivedOptions.env.USER, 'u');
    assert.equal(receivedOptions.platform, 'linux');
    assert.equal(typeof receivedOptions.confirmFn, 'function');
  });
});

describe('formatTelegramUninstallServiceHelp', () => {
  it('첫 줄이 token-weather telegram uninstall-service', () => {
    assert.match(
      formatTelegramUninstallServiceHelp()[0],
      /^token-weather telegram uninstall-service$/,
    );
  });
  it('제거 대상 + 주의 단락 포함', () => {
    const text = formatTelegramUninstallServiceHelp().join('\n');
    assert.match(text, /제거 대상/);
    assert.match(text, /config \/ auth\.json 은 건드리지 않습니다/);
    assert.match(text, /linger 해제는/);
  });
});
