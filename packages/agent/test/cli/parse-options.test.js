import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseCliOptions } from '../../src/cli/parse-options.js';

describe('parseCliOptions — defaults', () => {
  it('returns a shallow copy of defaults for empty args', () => {
    const defaults = { account: null, refreshLive: false };
    const out = parseCliOptions([], { defaults, flags: {} });
    assert.deepEqual(out, { account: null, refreshLive: false });
    assert.notEqual(out, defaults);
  });

  it('accepts null/undefined args as empty', () => {
    const spec = { defaults: { account: null }, flags: {} };
    assert.deepEqual(parseCliOptions(undefined, spec), { account: null });
    assert.deepEqual(parseCliOptions(null, spec), { account: null });
  });

  it('initializes warnings=[] only when collectWarnings=true', () => {
    const spec = { defaults: { foo: null }, flags: {}, collectWarnings: true };
    assert.deepEqual(parseCliOptions([], spec), { foo: null, warnings: [] });

    const specNoWarn = { defaults: { foo: null }, flags: {} };
    const out = parseCliOptions([], specNoWarn);
    assert.equal('warnings' in out, false);
  });
});

describe('parseCliOptions — boolean flags', () => {
  it('toggles matching boolean flags to true', () => {
    const out = parseCliOptions(['--refresh-live'], {
      defaults: { refreshLive: false },
      flags: { '--refresh-live': { key: 'refreshLive', type: 'boolean' } },
    });
    assert.equal(out.refreshLive, true);
  });

  it('leaves untoggled boolean flags at default', () => {
    const out = parseCliOptions([], {
      defaults: { manual: false, device: false },
      flags: {
        '--manual': { key: 'manual', type: 'boolean' },
        '--device': { key: 'device', type: 'boolean' },
      },
    });
    assert.equal(out.manual, false);
    assert.equal(out.device, false);
  });
});

describe('parseCliOptions — string flags', () => {
  it('consumes next arg as value', () => {
    const out = parseCliOptions(['--account', 'alice@x.com'], {
      defaults: { account: null },
      flags: { '--account': { key: 'account', type: 'string' } },
    });
    assert.equal(out.account, 'alice@x.com');
  });

  it('skips string flag with no following value', () => {
    const out = parseCliOptions(['--account'], {
      defaults: { account: null },
      flags: { '--account': { key: 'account', type: 'string' } },
    });
    assert.equal(out.account, null);
  });

  it('treats empty string as "no value" for non-trim string flag (legacy contract)', () => {
    // 레거시 파서(`if (value)`) 호환: ''가 들어와도 default 유지.
    const out = parseCliOptions(['--account', ''], {
      defaults: { account: null },
      flags: { '--account': { key: 'account', type: 'string' } },
    });
    assert.equal(out.account, null);
  });

  it('does not consume empty string so following flags still parse', () => {
    // ['--account', '', '--refresh-live'] → refreshLive가 여전히 true여야 한다.
    const out = parseCliOptions(['--account', '', '--refresh-live'], {
      defaults: { account: null, refreshLive: false },
      flags: {
        '--account': { key: 'account', type: 'string' },
        '--refresh-live': { key: 'refreshLive', type: 'boolean' },
      },
    });
    assert.equal(out.account, null);
    assert.equal(out.refreshLive, true);
  });

  it('trims and ignores empty trimmed value when trim=true', () => {
    const out = parseCliOptions(['--label', '   '], {
      defaults: { label: null },
      flags: {
        '--label': {
          key: 'label',
          type: 'string',
          trim: true,
          emptyMessage: '--label 값이 비어 있습니다.',
        },
      },
      collectWarnings: true,
    });
    assert.equal(out.label, null);
    assert.deepEqual(out.warnings, ['--label 값이 비어 있습니다.']);
  });

  it('does not push warning when collectWarnings=false even with emptyMessage', () => {
    const out = parseCliOptions(['--label', '   '], {
      defaults: { label: null },
      flags: {
        '--label': {
          key: 'label',
          type: 'string',
          trim: true,
          emptyMessage: 'noisy',
        },
      },
    });
    assert.equal(out.label, null);
    assert.equal('warnings' in out, false);
  });
});

describe('parseCliOptions — int flags', () => {
  const portFlag = {
    '--port': {
      key: 'port',
      type: 'int',
      validate: (n) => n >= 0 && n <= 65535,
      invalidMessage: '--port 값 "${value}"이(가) 유효하지 않습니다.',
    },
  };
  const timeoutFlag = {
    '--timeout': {
      key: 'timeoutMs',
      type: 'int',
      validate: (n) => n > 0,
      transform: (n) => n * 1000,
      invalidMessage: '--timeout 값 "${value}"이(가) 유효하지 않습니다.',
    },
  };

  it('parses valid integer', () => {
    const out = parseCliOptions(['--port', '38123'], {
      defaults: { port: null },
      flags: portFlag,
      collectWarnings: true,
    });
    assert.equal(out.port, 38123);
    assert.deepEqual(out.warnings, []);
  });

  it('accepts boundary values (0, 65535) when validate passes', () => {
    const mk = (v) =>
      parseCliOptions(['--port', v], {
        defaults: { port: null },
        flags: portFlag,
      }).port;
    assert.equal(mk('0'), 0);
    assert.equal(mk('65535'), 65535);
  });

  it('rejects non-integer values (1.5, "foo") with warning', () => {
    const opts1 = parseCliOptions(['--port', '1.5'], {
      defaults: { port: null },
      flags: portFlag,
      collectWarnings: true,
    });
    assert.equal(opts1.port, null);
    assert.equal(opts1.warnings.length, 1);

    const opts2 = parseCliOptions(['--port', 'foo'], {
      defaults: { port: null },
      flags: portFlag,
      collectWarnings: true,
    });
    assert.equal(opts2.port, null);
    assert.match(opts2.warnings[0], /--port 값 "foo"/);
  });

  it('rejects out-of-range values via validate', () => {
    const mk = (v) =>
      parseCliOptions(['--port', v], {
        defaults: { port: null },
        flags: portFlag,
        collectWarnings: true,
      });
    assert.equal(mk('65536').port, null);
    assert.equal(mk('65536').warnings.length, 1);
    assert.equal(mk('-1').port, null);
    assert.equal(mk('-1').warnings.length, 1);
  });

  it('applies transform on valid value (seconds → ms)', () => {
    const out = parseCliOptions(['--timeout', '300'], {
      defaults: { timeoutMs: 120_000 },
      flags: timeoutFlag,
      collectWarnings: true,
    });
    assert.equal(out.timeoutMs, 300_000);
    assert.deepEqual(out.warnings, []);
  });

  it('keeps default and warns when validate fails (timeout <= 0)', () => {
    const out = parseCliOptions(['--timeout', '0'], {
      defaults: { timeoutMs: 120_000 },
      flags: timeoutFlag,
      collectWarnings: true,
    });
    assert.equal(out.timeoutMs, 120_000);
    assert.equal(out.warnings.length, 1);
  });
});

describe('parseCliOptions — unknown flags', () => {
  it('silently skips unknown flags without consuming following args', () => {
    const out = parseCliOptions(['--unknown', '--account', 'a'], {
      defaults: { account: null },
      flags: { '--account': { key: 'account', type: 'string' } },
    });
    assert.equal(out.account, 'a');
  });
});

describe('parseCliOptions — includeHelp', () => {
  it('recognizes --help as options.help=true when includeHelp is set', () => {
    const out = parseCliOptions(['--help'], {
      defaults: { account: null },
      flags: { '--account': { key: 'account', type: 'string' } },
      includeHelp: true,
    });
    assert.equal(out.help, true);
    assert.equal(out.account, null);
  });

  it('also recognizes -h alias', () => {
    const out = parseCliOptions(['-h'], {
      defaults: {},
      flags: {},
      includeHelp: true,
    });
    assert.equal(out.help, true);
  });

  it('leaves help=false by default when includeHelp is set but flag absent', () => {
    const out = parseCliOptions([], {
      defaults: { account: null },
      flags: {},
      includeHelp: true,
    });
    assert.equal(out.help, false);
    assert.equal(out.account, null);
  });

  it('does not add help key when includeHelp is not set', () => {
    const out = parseCliOptions(['--help'], {
      defaults: { account: null },
      flags: {},
    });
    assert.equal('help' in out, false);
    assert.equal(out.account, null);
  });

  it('preserves caller-supplied help default when already in defaults', () => {
    const out = parseCliOptions([], {
      defaults: { help: 'custom' },
      flags: {},
      includeHelp: true,
    });
    // defaults에 이미 help가 있으면 덮어쓰지 않는다.
    assert.equal(out.help, 'custom');
  });
});

describe('parseCliOptions — combined', () => {
  it('collects multiple warnings independently', () => {
    const out = parseCliOptions(['--port', 'x', '--timeout', 'y'], {
      defaults: { port: null, timeoutMs: 120_000 },
      flags: {
        '--port': {
          key: 'port',
          type: 'int',
          validate: (n) => n >= 0 && n <= 65535,
          invalidMessage: '--port 값 "${value}" invalid',
        },
        '--timeout': {
          key: 'timeoutMs',
          type: 'int',
          validate: (n) => n > 0,
          transform: (n) => n * 1000,
          invalidMessage: '--timeout 값 "${value}" invalid',
        },
      },
      collectWarnings: true,
    });
    assert.equal(out.warnings.length, 2);
  });
});
