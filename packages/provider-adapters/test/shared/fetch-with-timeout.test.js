import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { fetchWithTimeout } from '../../src/shared/fetch-with-timeout.js';

function okResponse() {
  return { status: 200, ok: true, async text() { return ''; } };
}

function delayedResolve(ms, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

describe('fetchWithTimeout — basic', () => {
  it('passes the signal through to fetchImpl', async () => {
    let receivedInit;
    const fetchImpl = (_u, init) => {
      receivedInit = init;
      return Promise.resolve(okResponse());
    };
    await fetchWithTimeout(fetchImpl, 'https://t.test', {
      method: 'POST',
      body: 'x',
      timeoutMs: 1000,
    });
    assert.equal(receivedInit.method, 'POST');
    assert.equal(receivedInit.body, 'x');
    assert.ok(receivedInit.signal);
    assert.equal(receivedInit.signal.aborted, false);
  });

  it('skips timeout when timeoutMs is 0', async () => {
    let receivedInit;
    const fetchImpl = (_u, init) => {
      receivedInit = init;
      return Promise.resolve(okResponse());
    };
    await fetchWithTimeout(fetchImpl, 'https://t.test', { timeoutMs: 0 });
    // signal may still come from externalSignal path; here none provided
    assert.equal(receivedInit.signal, undefined);
  });

  it('forwards external signal aborts', async () => {
    const externalController = new AbortController();
    externalController.abort(new Error('external abort'));

    let receivedInit;
    const fetchImpl = (_u, init) => {
      receivedInit = init;
      // Simulate fetch rejecting on pre-aborted signal
      return init.signal?.aborted
        ? Promise.reject(new Error('aborted'))
        : Promise.resolve(okResponse());
    };

    await assert.rejects(
      () =>
        fetchWithTimeout(fetchImpl, 'https://t.test', {
          timeoutMs: 1000,
          signal: externalController.signal,
        }),
    );
    assert.equal(receivedInit.signal.aborted, true);
  });
});

describe('fetchWithTimeout — timeout fires', () => {
  it('aborts when timeoutMs elapses before fetch resolves', async () => {
    const fetchImpl = (_u, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason));
        // never resolve otherwise
      });

    await assert.rejects(
      () => fetchWithTimeout(fetchImpl, 'https://t.test', { timeoutMs: 30 }),
      /timed out/,
    );
  });

  it('does not abort when fetch resolves before timeout', async () => {
    const fetchImpl = () => delayedResolve(10, okResponse());
    const res = await fetchWithTimeout(fetchImpl, 'https://t.test', { timeoutMs: 1000 });
    assert.equal(res.status, 200);
  });
});
