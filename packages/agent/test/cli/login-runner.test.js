import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseLoginOptions } from '../../src/cli/login-runner.js';

describe('parseLoginOptions — defaults & flags', () => {
  it('returns defaults for empty args', () => {
    assert.deepEqual(parseLoginOptions([]), {
      noOpen: false,
      manual: false,
      device: false,
      liveExchange: false,
      port: null,
      timeoutMs: 120_000,
      warnings: [],
    });
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
