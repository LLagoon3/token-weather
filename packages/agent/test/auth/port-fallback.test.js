import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';

import {
  resolveCallbackPort,
  DEFAULT_CALLBACK_PORT,
  MAX_PORT_RETRIES,
  isPortAvailable,
} from '../../src/auth/port-fallback.js';

function occupy(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.once('listening', () => resolve(server));
    server.listen(port, '127.0.0.1');
  });
}

async function findFreePort(start) {
  for (let i = 0; i < 100; i++) {
    const candidate = start + i;
    if (await isPortAvailable(candidate)) return candidate;
  }
  throw new Error('no free port found for test');
}

describe('resolveCallbackPort', () => {
  it('returns preferredPort when available', async () => {
    const port = await findFreePort(45000);
    const result = await resolveCallbackPort({ preferredPort: port });
    assert.equal(result.port, port);
    assert.equal(result.fallbackExhausted, false);
  });

  it('returns null when preferredPort is occupied (no fallback for user-specified)', async () => {
    const port = await findFreePort(46000);
    const server = await occupy(port);
    try {
      const result = await resolveCallbackPort({ preferredPort: port });
      assert.equal(result.port, null);
      assert.equal(result.fallbackExhausted, false);
    } finally {
      server.close();
    }
  });

  it('uses custom defaultPort when provided', async () => {
    const base = await findFreePort(47000);
    const result = await resolveCallbackPort({ defaultPort: base });
    assert.equal(result.port, base);
    assert.equal(result.fallbackExhausted, false);
  });

  it('fallbacks to defaultPort + 1 when default is occupied', async () => {
    const base = await findFreePort(48000);
    const occupied = await occupy(base);
    try {
      const result = await resolveCallbackPort({ defaultPort: base });
      assert.equal(result.port, base + 1);
    } finally {
      occupied.close();
    }
  });

  it('returns fallbackExhausted when all candidates are occupied', async () => {
    const base = await findFreePort(49000);
    const servers = [];
    try {
      for (let i = 0; i <= MAX_PORT_RETRIES; i++) {
        servers.push(await occupy(base + i));
      }
      const result = await resolveCallbackPort({ defaultPort: base });
      assert.equal(result.port, null);
      assert.equal(result.fallbackExhausted, true);
    } finally {
      for (const s of servers) s.close();
    }
  });

  it('exports DEFAULT_CALLBACK_PORT=1455 as documented', () => {
    assert.equal(DEFAULT_CALLBACK_PORT, 1455);
  });
});
