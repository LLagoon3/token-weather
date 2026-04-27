# TypeScript 사용자용 가이드

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
import { fetchClaudeUsage } from '@token-weather/provider-adapters/src/claude/fetch-claude-usage.js';

const snapshot = await getStatusSnapshot({ providerFilter: 'claude' });
//    ^? StatusSnapshot — schemaVersion / configPath / providers / claude? / ...

const result = validateUsageSnapshot(payload);
//    ^? { valid: boolean; errors: string[] }
```

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
- TypeScript 자체 컨버전은 본 정책 범위가 아닙니다.
- 자동 sanity check (CI에 외부 TS project 컴파일 step) 도입은 후속 이슈에서 검토 (T2 #75 install smoke와 함께 묶일 수 있음).
