import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  enrichIdentityFromProviderProfile,
  parseLoginOptions,
} from '../../src/cli/login-runner.js';

describe('enrichIdentityFromProviderProfile', () => {
  it('returns original identity for non-claude providers', async () => {
    const identity = {
      email: 'fallback@example.com',
      accountId: null,
      displayName: null,
      claimSource: 'fallback:code-prefix',
    };

    const result = await enrichIdentityFromProviderProfile(
      { id: 'codex' },
      { accessToken: 'token-123' },
      identity,
    );

    assert.equal(result.profile, null);
    assert.deepEqual(result.identity, identity);
  });

  it('enriches Claude identity from oauth/profile', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      status: 200,
      statusText: 'OK',
      ok: true,
      async json() {
        return {
          account: {
            uuid: 'acct-123',
            display_name: '에버다임 IT팀',
            email: 'everdigm.itteam@gmail.com',
          },
          organization: { uuid: 'org-123' },
          application: { uuid: 'app-123' },
        };
      },
    });

    try {
      const result = await enrichIdentityFromProviderProfile(
        { id: 'claude' },
        { accessToken: 'token-123' },
        {
          email: 'live-abc@claude.com',
          accountId: null,
          displayName: null,
          claimSource: 'fallback:code-prefix',
        },
      );

      assert.equal(result.identity.email, 'everdigm.itteam@gmail.com');
      assert.equal(result.identity.accountId, 'acct-123');
      assert.equal(result.identity.displayName, '에버다임 IT팀');
      assert.equal(result.identity.claimSource, 'profile');
      assert.equal(result.profile.organization.uuid, 'org-123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('keeps fallback identity when profile fetch fails', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      status: 403,
      statusText: 'Forbidden',
      ok: false,
      async json() {
        return { error: { message: 'missing scope' } };
      },
    });

    const identity = {
      email: 'live-abc@claude.com',
      accountId: null,
      displayName: null,
      claimSource: 'fallback:code-prefix',
    };

    try {
      const result = await enrichIdentityFromProviderProfile(
        { id: 'claude' },
        { accessToken: 'token-123' },
        identity,
      );

      assert.equal(result.profile, null);
      assert.deepEqual(result.identity, identity);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('parseLoginOptions — defaults & flags', () => {
  it('returns defaults for empty args', () => {
    assert.deepEqual(parseLoginOptions([]), {
      noOpen: false,
      manual: false,
      device: false,
      liveExchange: false,
      port: null,
      timeoutMs: 120_000,
      label: null,
      keepLegacy: false,
      warnings: [],
      help: false,
    });
  });

  it('recognizes --help and -h', () => {
    assert.equal(parseLoginOptions(['--help']).help, true);
    assert.equal(parseLoginOptions(['-h']).help, true);
  });

  it('handles null/undefined args', () => {
    const opts = parseLoginOptions(undefined);
    assert.equal(opts.port, null);
    assert.equal(opts.timeoutMs, 120_000);
    assert.deepEqual(opts.warnings, []);
  });

  it('toggles boolean flags', () => {
    const opts = parseLoginOptions(['--no-open', '--manual', '--live-exchange']);
    assert.equal(opts.noOpen, true);
    assert.equal(opts.manual, true);
    assert.equal(opts.liveExchange, true);
    assert.equal(opts.device, false);
  });

  it('ignores unknown flags', () => {
    const opts = parseLoginOptions(['--unknown', '--manual']);
    assert.equal(opts.manual, true);
  });
});

describe('parseLoginOptions — --port validation', () => {
  it('accepts valid port in range', () => {
    const opts = parseLoginOptions(['--port', '38123']);
    assert.equal(opts.port, 38123);
    assert.deepEqual(opts.warnings, []);
  });

  it('accepts boundary values 0 and 65535', () => {
    assert.equal(parseLoginOptions(['--port', '0']).port, 0);
    assert.equal(parseLoginOptions(['--port', '65535']).port, 65535);
  });

  it('warns and keeps port=null for NaN input ("foo")', () => {
    const opts = parseLoginOptions(['--port', 'foo']);
    assert.equal(opts.port, null);
    assert.equal(opts.warnings.length, 1);
    assert.match(opts.warnings[0], /--port 값 "foo"/);
  });

  it('warns for out-of-range port (65536)', () => {
    const opts = parseLoginOptions(['--port', '65536']);
    assert.equal(opts.port, null);
    assert.equal(opts.warnings.length, 1);
  });

  it('warns for negative port', () => {
    const opts = parseLoginOptions(['--port', '-1']);
    assert.equal(opts.port, null);
    assert.equal(opts.warnings.length, 1);
  });

  it('warns for non-integer port (1.5)', () => {
    const opts = parseLoginOptions(['--port', '1.5']);
    assert.equal(opts.port, null);
    assert.equal(opts.warnings.length, 1);
  });
});

describe('parseLoginOptions — --timeout validation', () => {
  it('parses --timeout as seconds → ms', () => {
    const opts = parseLoginOptions(['--timeout', '300']);
    assert.equal(opts.timeoutMs, 300_000);
    assert.deepEqual(opts.warnings, []);
  });

  it('warns and keeps default for NaN input', () => {
    const opts = parseLoginOptions(['--timeout', 'abc']);
    assert.equal(opts.timeoutMs, 120_000);
    assert.equal(opts.warnings.length, 1);
    assert.match(opts.warnings[0], /--timeout 값 "abc"/);
  });

  it('warns for zero timeout', () => {
    const opts = parseLoginOptions(['--timeout', '0']);
    assert.equal(opts.timeoutMs, 120_000);
    assert.equal(opts.warnings.length, 1);
  });

  it('warns for negative timeout', () => {
    const opts = parseLoginOptions(['--timeout', '-30']);
    assert.equal(opts.timeoutMs, 120_000);
    assert.equal(opts.warnings.length, 1);
  });
});

describe('parseLoginOptions — combined', () => {
  it('combines valid flags + invalid values yields both options and warnings', () => {
    const opts = parseLoginOptions([
      '--port', 'foo',
      '--timeout', '60',
      '--live-exchange',
    ]);
    assert.equal(opts.port, null);        // invalid, stays null
    assert.equal(opts.timeoutMs, 60_000); // valid
    assert.equal(opts.liveExchange, true);
    assert.equal(opts.warnings.length, 1);
  });

  it('collects multiple warnings independently', () => {
    const opts = parseLoginOptions(['--port', 'x', '--timeout', 'y']);
    assert.equal(opts.warnings.length, 2);
  });
});

describe('parseLoginOptions — --keep-legacy', () => {
  it('toggles keepLegacy=true', () => {
    const opts = parseLoginOptions(['--keep-legacy']);
    assert.equal(opts.keepLegacy, true);
  });

  it('defaults to false when not provided', () => {
    assert.equal(parseLoginOptions([]).keepLegacy, false);
  });
});

describe('parseLoginOptions — --label', () => {
  it('stores trimmed label value', () => {
    const opts = parseLoginOptions(['--label', '  work  ']);
    assert.equal(opts.label, 'work');
    assert.deepEqual(opts.warnings, []);
  });

  it('warns when label is empty string', () => {
    const opts = parseLoginOptions(['--label', '   ']);
    assert.equal(opts.label, null);
    assert.equal(opts.warnings.length, 1);
    assert.match(opts.warnings[0], /--label 값이 비어/);
  });

  it('accepts --label together with --live-exchange', () => {
    const opts = parseLoginOptions(['--label', 'personal', '--live-exchange']);
    assert.equal(opts.label, 'personal');
    assert.equal(opts.liveExchange, true);
  });
});
