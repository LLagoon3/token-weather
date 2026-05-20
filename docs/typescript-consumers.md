# TypeScript 사용자용 가이드

🌐 [English](./typescript-consumers.en.md) · **한국어**

Token Weather 패키지는 JS+JSDoc 소스로 작성되었지만, publish 시 `tsc --emitDeclarationOnly`로 생성한 `.d.ts`가 함께 동봉됩니다. TypeScript 프로젝트에서 그대로 import하면 자동완성·타입 추론이 동작합니다.

## 사용

```bash
npm install @token-weather/cli
# 또는 (라이브러리만 사용 시)
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

> **Import 경로 규약**: 본 PR이 보장하는 타입 계약은 **각 패키지의 root entry**(`package.json::types`가 가리키는 `./dist/types/index.d.ts`) 기준입니다. 위 예시는 모두 `@token-weather/{cli,schemas,provider-adapters}` root에서 import. **subpath import**(`@token-weather/provider-adapters/src/claude/fetch-claude-usage.js` 같은 형태)는 동작은 하지만 본 PR의 타입 계약에 포함되지 않으며, 향후 `exports`/`typesVersions` 도입 시 별도 설계가 필요합니다. 안정적인 사용은 root import를 우선하세요.

## 타입 동봉 정책

- 빌드 단계는 `tsc --emitDeclarationOnly --allowJs --declaration` 한 단계.
- 각 패키지의 `dist/types/index.d.ts`가 `package.json::types`로 노출됨.
- `npm publish` 시 `files` 화이트리스트에 `dist/types`가 포함되어 tarball에 자동 포함.
- 소스는 그대로 JS+JSDoc — TypeScript 컨버전 없음.

## 현재 d.ts 품질

핵심 export 5개는 본 PR(#73)에서 JSDoc을 보강해 정확한 타입으로 추론됩니다:

- `getStatusSnapshot` — `Promise<StatusSnapshot>`
- `runCli` — `(argv: string[]) => Promise<void>`
- `formatStatusJson` — snapshot/meta param이 inline shape로 명시
- `fetchClaudeUsage` — `Promise<{ source, authType, confidence, usageWindows, ... }>`
- `exchangeClaudeAuthorizationCode` — `Promise<{ accessToken, refreshToken, idToken, ... }>`

그 외 export(예: `auth/`, `codex-provider`, 일부 helper)는 JSDoc이 부분적이라 `any` 또는 의미 없는 `Promise<object>`로 추론될 수 있습니다. 후속 chore PR에서 점진적으로 개선 예정.

새 토큰성 필드를 provider adapter / auth schema에 추가하는 PR은 동시에 JSDoc도 보강해 d.ts 품질이 떨어지지 않도록 합니다 (`docs/codebase-guide.md` 참고).

## Manual sanity check 절차 (메인테이너)

> **자동 검증**: 아래 단계 1-2(pack + 임시 install)는 [`scripts/install-smoke.sh`](../scripts/install-smoke.sh)가 PR마다 CI에서 자동 수행한다 (#75 도입). 본 절차는 단계 3-5(`tsc --noEmit` + IDE 자동완성)까지의 **타입 추론 품질**을 사람이 확인하고 싶을 때 사용한다.

publish 직전 외부 TypeScript 프로젝트에서 import / 추론이 동작하는지 수동 검증:

```bash
# 1. tarball 생성
npm pack --workspace=@token-weather/cli
npm pack --workspace=@token-weather/provider-adapters
npm pack --workspace=@token-weather/schemas
# → token-weather-{cli,provider-adapters,schemas}-0.1.0.tgz 생성됨

# 2. 임시 디렉토리에 minimal TS project
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

# 4. 검증: 타입 에러 0건이어야 함
npx tsc --noEmit

# 5. (선택) IDE에서 import 자동완성 확인
code .
```

타입 추론이 정상 동작하면:

- `snapshot.schemaVersion`이 `string`으로 자동완성에 노출
- `result.valid`가 `boolean`, `result.errors`가 `string[]`
- 미보강 export는 `any`로 표시되지만 컴파일 에러는 없음

## 한계

- 본 d.ts emission은 **JSDoc 커버리지에 의존**합니다. 미보강 export는 정확한 타입을 받지 못합니다 (any로 노출).
- **타입 계약 범위는 package root entry만**: `package.json::types`가 가리키는 `./dist/types/index.d.ts`만 stable. subpath import (`@token-weather/.../src/...`)는 동작하지만 본 PR scope 외이고, 후속에서 `exports` 필드와 `typesVersions`로 공식 지원 여부 결정 (현재 main 사용 중이라 도입은 별도 PR로).
- TypeScript 자체 컨버전은 본 정책 범위가 아닙니다.
- 자동 install/import 검증: `scripts/install-smoke.sh` (#75)가 PR마다 CI에서 pack + tmp install + bin smoke + d.ts 산출물 존재까지 수행. `tsc --noEmit` 단계는 본 manual 절차에 남아있다 — 자동화는 별도 후속 이슈에서 검토.
