import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseLoginOptions } from '../../src/cli/login-runner.js';

describe('parseLoginOptions', () => {
  it('returns defaults for empty args', () => {
    assert.deepEqual(parseLoginOptions([]), {
      noOpen: false,
      manual: false,
      device: false,
      liveExchange: false,
      port: null,
      timeoutMs: 120_000,
    });
  });

  it('handles null/undefined args', () => {
    const opts = parseLoginOptions(undefined);
    assert.equal(opts.port, null);
    assert.equal(opts.timeoutMs, 120_000);
  });

  it('toggles boolean flags', () => {
    const opts = parseLoginOptions(['--no-open', '--manual', '--live-exchange']);
    assert.equal(opts.noOpen, true);
    assert.equal(opts.manual, true);
    assert.equal(opts.liveExchange, true);
    assert.equal(opts.device, false);
  });

  it('parses --port as number', () => {
    const opts = parseLoginOptions(['--port', '38123']);
    assert.equal(opts.port, 38123);
  });

  it('parses --timeout as seconds → ms', () => {
    const opts = parseLoginOptions(['--timeout', '300']);
    assert.equal(opts.timeoutMs, 300_000);
  });

  it('ignores unknown flags', () => {
    const opts = parseLoginOptions(['--unknown', '--manual']);
    assert.equal(opts.manual, true);
  });

  it('combines multiple flags and positional values correctly', () => {
    const opts = parseLoginOptions([
      '--port', '5000',
      '--timeout', '60',
      '--live-exchange',
    ]);
    assert.equal(opts.port, 5000);
    assert.equal(opts.timeoutMs, 60_000);
    assert.equal(opts.liveExchange, true);
  });
});
