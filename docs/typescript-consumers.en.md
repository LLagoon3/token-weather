# TypeScript consumers guide

🌐 **English** · [한국어](./typescript-consumers.md)

> Translated from [typescript-consumers.md](./typescript-consumers.md) — last sync 2026-05-20. The Korean version is the source of truth; this English version follows it. See [CONTRIBUTING.md §10](../CONTRIBUTING.md) for the i18n drift policy.

Token Weather packages are written in JS + JSDoc, but `.d.ts` files generated via `tsc --emitDeclarationOnly` are shipped alongside on publish. Importing them directly into a TypeScript project gives you autocomplete and type inference out of the box.

## Usage

```bash
npm install @token-weather/cli
# or (for library-only usage)
npm install @token-weather/schemas @token-weather/provider-adapters
```

```ts
import { getStatusSnapshot } from '@token-weather/cli';
import { validateUsageSnapshot, SCHEMA_VERSION } from '@token-weather/schemas';
import { fetchClaudeUsage } from '@token-weather/provider-adapters';

const snapshot = await getStatusSnapshot({ providerFilter: 'claude' });
//    ^? StatusSnapshot — schemaVersion / configPath / providers / claude? / ...

const result = validateUsageSnapshot(payload);
//    ^? { valid: boolean; errors: string[] }
```

> **Import-path convention**: the type contract guaranteed by this PR is based on **each package's root entry** (`./dist/types/index.d.ts` as pointed to by `package.json::types`). All examples above import from the root of `@token-weather/{cli,schemas,provider-adapters}`. **Subpath imports** (forms like `@token-weather/provider-adapters/src/claude/fetch-claude-usage.js`) work, but they are not included in this PR's type contract; if `exports` / `typesVersions` are introduced later, a separate design is needed. For stable use, prefer root imports.

## Type-shipping policy

- One build step: `tsc --emitDeclarationOnly --allowJs --declaration`.
- Each package's `dist/types/index.d.ts` is exposed as `package.json::types`.
- On `npm publish`, the `files` whitelist includes `dist/types` so the tarball includes it automatically.
- The source stays in JS + JSDoc — no TypeScript conversion.

## Current d.ts quality

Five core exports were JSDoc-enriched in this PR (#73) so they infer accurate types:

- `getStatusSnapshot` — `Promise<StatusSnapshot>`
- `runCli` — `(argv: string[]) => Promise<void>`
- `formatStatusJson` — `snapshot` / `meta` params specified as inline shapes
- `fetchClaudeUsage` — `Promise<{ source, authType, confidence, usageWindows, ... }>`
- `exchangeClaudeAuthorizationCode` — `Promise<{ accessToken, refreshToken, idToken, ... }>`

Other exports (e.g., `auth/`, `codex-provider`, some helpers) have partial JSDoc and may infer to `any` or a meaningless `Promise<object>`. Planned to be improved incrementally in follow-up chore PRs.

PRs that add new token-bearing fields to provider adapters / the auth schema should also enrich JSDoc, so that d.ts quality doesn't degrade (see `docs/codebase-guide.md`).

## Manual sanity check procedure (for maintainers)

> **Automated check**: steps 1–2 below (pack + temp install) are automatically performed on every PR in CI by [`scripts/install-smoke.sh`](../scripts/install-smoke.sh) (introduced in #75). This procedure is for when you want a person to verify the **type-inference quality** through steps 3–5 (`tsc --noEmit` + IDE autocomplete).

A manual check that import / inference works in an external TypeScript project just before publish:

```bash
# 1. Create tarballs
npm pack --workspace=@token-weather/cli
npm pack --workspace=@token-weather/provider-adapters
npm pack --workspace=@token-weather/schemas
# → token-weather-{cli,provider-adapters,schemas}-0.1.0.tgz are created

# 2. Minimal TS project in a temp directory
TMP=$(mktemp -d -t tw-ts-sanity-XXXXXX)
cd "$TMP"
npm init -y
npm install typescript --save-dev
npm install /path/to/token-weather-cli-0.1.0.tgz \
            /path/to/token-weather-provider-adapters-0.1.0.tgz \
            /path/to/token-weather-schemas-0.1.0.tgz

# 3. tsconfig.json + index.ts
cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "strict": true,
    "noEmit": true
  },
  "include": ["index.ts"]
}
EOF

cat > index.ts <<'EOF'
import { getStatusSnapshot } from '@token-weather/cli';
import { validateUsageSnapshot, SCHEMA_VERSION } from '@token-weather/schemas';

async function main() {
  const snapshot = await getStatusSnapshot();
  console.log(snapshot.schemaVersion);
  const result = validateUsageSnapshot({});
  if (!result.valid) console.error(result.errors);
}

void main();
EOF

# 4. Verify: zero type errors expected
npx tsc --noEmit

# 5. (Optional) Verify IDE import autocomplete
code .
```

If type inference works correctly:

- `snapshot.schemaVersion` is exposed in autocomplete as `string`
- `result.valid` is `boolean`, `result.errors` is `string[]`
- Non-enriched exports show as `any`, but there are no compile errors

## Limits

- This d.ts emission **depends on JSDoc coverage**. Non-enriched exports do not get precise types (they show as `any`).
- **Type-contract scope is only the package's root entry**: `./dist/types/index.d.ts` as pointed to by `package.json::types` is the only stable surface. Subpath imports (`@token-weather/.../src/...`) work but are outside this PR's scope; whether to officially support them via `exports` and `typesVersions` is a follow-up decision (since main is in use, it would be a separate PR).
- TypeScript conversion of the source itself is out of policy scope.
- Automated install / import verification: `scripts/install-smoke.sh` (#75) runs pack + temp install + bin smoke + d.ts artifact presence on every PR in CI. The `tsc --noEmit` step remains in this manual procedure — automating it is a follow-up issue.
