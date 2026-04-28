import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  redactSensitive,
  formatStatusJson,
  isSensitiveKey,
  SENSITIVE_KEYS,
} from '../../src/cli/status-json.js';

describe('SENSITIVE_KEYS', () => {
  it('contains the expected camelCase token fields', () => {
    assert.ok(SENSITIVE_KEYS.has('accessToken'));
    assert.ok(SENSITIVE_KEYS.has('refreshToken'));
    assert.ok(SENSITIVE_KEYS.has('idToken'));
    assert.ok(SENSITIVE_KEYS.has('tokens'));
    assert.ok(SENSITIVE_KEYS.has('sessionKey'));
    assert.ok(SENSITIVE_KEYS.has('sessionCookie'));
    assert.ok(SENSITIVE_KEYS.has('codeVerifier'));
    assert.ok(SENSITIVE_KEYS.has('clientSecret'));
  });

  it('also contains snake_case variants (OAuth-style)', () => {
    assert.ok(SENSITIVE_KEYS.has('access_token'));
    assert.ok(SENSITIVE_KEYS.has('refresh_token'));
    assert.ok(SENSITIVE_KEYS.has('id_token'));
    assert.ok(SENSITIVE_KEYS.has('client_secret'));
    assert.ok(SENSITIVE_KEYS.has('code_verifier'));
    assert.ok(SENSITIVE_KEYS.has('session_key'));
    assert.ok(SENSITIVE_KEYS.has('session_cookie'));
  });

  it('contains HTTP credential headers and generic API keys', () => {
    assert.ok(SENSITIVE_KEYS.has('authorization'));
    assert.ok(SENSITIVE_KEYS.has('cookie'));
    assert.ok(SENSITIVE_KEYS.has('apiKey'));
    assert.ok(SENSITIVE_KEYS.has('api_key'));
    assert.ok(SENSITIVE_KEYS.has('password'));
  });
});

describe('isSensitiveKey — case-insensitive matching', () => {
  it('matches the canonical camelCase form', () => {
    assert.equal(isSensitiveKey('accessToken'), true);
    assert.equal(isSensitiveKey('refreshToken'), true);
  });

  it('matches different casings (AccessToken / ACCESSTOKEN / accesstoken)', () => {
    assert.equal(isSensitiveKey('AccessToken'), true);
    assert.equal(isSensitiveKey('ACCESSTOKEN'), true);
    assert.equal(isSensitiveKey('accesstoken'), true);
    assert.equal(isSensitiveKey('Refresh_Token'), true);
    assert.equal(isSensitiveKey('AUTHORIZATION'), true);
  });

  it('returns false for unrelated keys', () => {
    assert.equal(isSensitiveKey('email'), false);
    assert.equal(isSensitiveKey('accountKey'), false);
    assert.equal(isSensitiveKey('label'), false);
  });
});

describe('redactSensitive — primitives', () => {
  it('passes through null/undefined/boolean/number/string', () => {
    assert.equal(redactSensitive(null), null);
    assert.equal(redactSensitive(undefined), undefined);
    assert.equal(redactSensitive(true), true);
    assert.equal(redactSensitive(0), 0);
    assert.equal(redactSensitive('hello'), 'hello');
  });

  it('passes through Date as-is (will serialize via toJSON)', () => {
    const d = new Date('2026-04-25T00:00:00Z');
    assert.equal(redactSensitive(d), d);
  });
});

describe('redactSensitive — objects', () => {
  it('removes top-level sensitive keys', () => {
    const out = redactSensitive({
      email: 'a@b.com',
      accessToken: 'xxx',
      refreshToken: 'yyy',
      idToken: 'zzz',
    });
    assert.deepEqual(out, { email: 'a@b.com' });
  });

  it('removes the entire `tokens` subtree', () => {
    const out = redactSensitive({
      accountKey: 'k',
      tokens: { accessToken: 'a', refreshToken: 'b' },
    });
    assert.deepEqual(out, { accountKey: 'k' });
  });

  it('removes nested sensitive keys at any depth', () => {
    const out = redactSensitive({
      claude: {
        selectedAccount: {
          accountKey: 'k',
          tokens: { accessToken: 'a' },
          accessToken: 'top',
        },
      },
    });
    assert.deepEqual(out, {
      claude: {
        selectedAccount: { accountKey: 'k' },
      },
    });
  });

  it('walks into arrays', () => {
    const out = redactSensitive({
      accounts: [
        { id: 1, accessToken: 'a' },
        { id: 2, refreshToken: 'b' },
      ],
    });
    assert.deepEqual(out, { accounts: [{ id: 1 }, { id: 2 }] });
  });

  it('removes snake_case variants (refresh_token / access_token / id_token)', () => {
    const out = redactSensitive({
      accountKey: 'k',
      access_token: 'A',
      refresh_token: 'R',
      id_token: 'I',
    });
    assert.deepEqual(out, { accountKey: 'k' });
  });

  it('removes generic credential headers (authorization / cookie / apiKey)', () => {
    const out = redactSensitive({
      label: 'work',
      authorization: 'Bearer xyz',
      cookie: 'session=abc',
      apiKey: 'k123',
      api_key: 'k456',
      password: 'p1',
    });
    assert.deepEqual(out, { label: 'work' });
  });

  it('matches keys case-insensitively (AccessToken / Refresh-Token style stays caught)', () => {
    const out = redactSensitive({
      accountKey: 'k',
      AccessToken: 'A',
      Refresh_Token: 'R',
      ID_TOKEN: 'I',
      Authorization: 'Bearer xyz',
    });
    assert.deepEqual(out, { accountKey: 'k' });
  });

  it('does not mutate the original input', () => {
    const original = {
      account: { tokens: { accessToken: 'a' }, email: 'x@y.com' },
    };
    const snapshot = JSON.parse(JSON.stringify(original));
    redactSensitive(original);
    assert.deepEqual(original, snapshot);
  });
});

describe('formatStatusJson — shape', () => {
  it('returns a single-line JSON string (no newline)', () => {
    const json = formatStatusJson({
      schemaVersion: 1,
      configPath: '/x',
      providers: { codex: { enabled: true }, claude: { enabled: true } },
      sync: { enabled: false },
    });
    assert.equal(typeof json, 'string');
    assert.equal(json.includes('\n'), false);
  });

  it('always emits a JSON-parseable string', () => {
    const json = formatStatusJson({
      schemaVersion: 1,
      configPath: '/x',
      providers: { codex: { enabled: true }, claude: { enabled: true } },
      sync: { enabled: false },
    });
    assert.doesNotThrow(() => JSON.parse(json));
  });

  it('includes top-level command, generatedAt, schemaVersion, configPath', () => {
    const json = formatStatusJson(
      {
        schemaVersion: 1,
        configPath: '/cfg',
        providers: { codex: { enabled: true }, claude: { enabled: true } },
        sync: { enabled: false },
      },
      { command: 'usage', generatedAt: '2026-04-25T01:02:03Z' },
    );
    const parsed = JSON.parse(json);
    assert.equal(parsed.command, 'usage');
    assert.equal(parsed.generatedAt, '2026-04-25T01:02:03Z');
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.configPath, '/cfg');
  });

  it('uses now() when generatedAt not provided', () => {
    const before = new Date();
    const json = formatStatusJson({
      schemaVersion: 1,
      configPath: '/x',
      providers: { codex: {}, claude: {} },
      sync: {},
    });
    const after = new Date();
    const parsed = JSON.parse(json);
    const at = new Date(parsed.generatedAt);
    assert.ok(at >= before && at <= after);
  });

  it('defaults command to "status" when not provided', () => {
    const json = formatStatusJson({
      schemaVersion: 1,
      configPath: '/x',
      providers: { codex: {}, claude: {} },
      sync: {},
    });
    assert.equal(JSON.parse(json).command, 'status');
  });
});

describe('formatStatusJson — providers array', () => {
  it('emits providers[] with id and snapshot for each present provider', () => {
    const json = formatStatusJson({
      schemaVersion: 1,
      configPath: '/x',
      providers: { codex: { enabled: true }, claude: { enabled: true } },
      sync: {},
      codex: { enabled: true, snapshots: [] },
      claude: { detected: false },
    });
    const parsed = JSON.parse(json);
    assert.equal(parsed.providers.length, 2);
    assert.deepEqual(parsed.providers.map((p) => p.id).sort(), ['claude', 'codex']);
    const codexEntry = parsed.providers.find((p) => p.id === 'codex');
    assert.deepEqual(codexEntry.snapshot, { enabled: true, snapshots: [] });
  });

  it('only includes the matching provider when providerFilter is set', () => {
    const json = formatStatusJson({
      schemaVersion: 1,
      configPath: '/x',
      providers: { codex: { enabled: true }, claude: { enabled: true } },
      sync: {},
      providerFilter: 'codex',
      codex: { enabled: true, snapshots: [] },
      // claude key absent — runProviderSnapshots already filtered
    });
    const parsed = JSON.parse(json);
    assert.equal(parsed.providerFilter, 'codex');
    assert.deepEqual(
      parsed.providers.map((p) => p.id),
      ['codex'],
    );
  });

  it('exposes accountFilter at top level', () => {
    const json = formatStatusJson({
      schemaVersion: 1,
      configPath: '/x',
      providers: { codex: {}, claude: {} },
      sync: {},
      accountFilter: 'work',
      codex: {},
      claude: {},
    });
    assert.equal(JSON.parse(json).accountFilter, 'work');
  });

  it('emits null filters by default', () => {
    const parsed = JSON.parse(
      formatStatusJson({
        schemaVersion: 1,
        configPath: '/x',
        providers: { codex: {}, claude: {} },
        sync: {},
        codex: {},
        claude: {},
      }),
    );
    assert.equal(parsed.accountFilter, null);
    assert.equal(parsed.providerFilter, null);
  });
});

describe('formatStatusJson — redaction (security)', () => {
  it('strips tokens from claude.selectedAccount.tokens', () => {
    const json = formatStatusJson({
      schemaVersion: 1,
      configPath: '/x',
      providers: { codex: {}, claude: {} },
      sync: {},
      codex: {},
      claude: {
        detected: true,
        selectedAccount: {
          accountKey: 'k',
          email: 'a@b.com',
          tokens: {
            accessToken: 'SECRET-A',
            refreshToken: 'SECRET-R',
            idToken: 'SECRET-I',
          },
        },
      },
    });
    assert.equal(json.includes('SECRET-A'), false);
    assert.equal(json.includes('SECRET-R'), false);
    assert.equal(json.includes('SECRET-I'), false);

    const parsed = JSON.parse(json);
    const claude = parsed.providers.find((p) => p.id === 'claude').snapshot;
    assert.equal(claude.selectedAccount.accountKey, 'k');
    assert.equal('tokens' in claude.selectedAccount, false);
  });

  it('strips top-level accessToken on imported accounts (claude-cli-import shape)', () => {
    const json = formatStatusJson({
      schemaVersion: 1,
      configPath: '/x',
      providers: { codex: {}, claude: {} },
      sync: {},
      codex: {},
      claude: {
        selectedAccount: { accountKey: 'k', accessToken: 'TOP-LEVEL-TOKEN' },
      },
    });
    assert.equal(json.includes('TOP-LEVEL-TOKEN'), false);
  });

  it('strips tokens from any nested array entry (multi-account)', () => {
    const json = formatStatusJson({
      schemaVersion: 1,
      configPath: '/x',
      providers: { codex: {}, claude: {} },
      sync: {},
      codex: {},
      claude: {
        networkUsages: [
          {
            accountKey: 'k1',
            account: { tokens: { accessToken: 'A1' } },
            snapshot: { status: { ok: true } },
          },
          {
            accountKey: 'k2',
            account: { accessToken: 'A2' },
            snapshot: { status: { ok: true } },
          },
        ],
      },
    });
    assert.equal(json.includes('A1'), false);
    assert.equal(json.includes('A2'), false);
  });
});
