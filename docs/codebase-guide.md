# Codebase Guide (Claude 세션용)

이 문서는 **다른 Claude Code 세션**이 이 repo에서 작업할 때 구조적 일관성을 유지하기 위한 참조 문서다. 새로운 기능을 추가하거나 수정할 때 먼저 여기를 읽고, 기존 패턴을 재사용할지 / 예외를 만들지 명시적으로 결정하라.

관련 문서:
- `CONTRIBUTING.md` — 브랜치 / 커밋 / PR 규칙
- `docs/architecture.md` — 고수준 구조 요약
- `docs/auth-architecture.md` — 인증 상세 설계
- `docs/auth-cli.md` — auth CLI 명령 / 정책
- `docs/provider-notes.md` — provider별 observed 값과 endpoint

---

## 1. 패키지 레이아웃

```
packages/
├── agent/                     CLI 진입점 + runtime orchestration
│   ├── bin/ai-usage-agent.js
│   └── src/
│       ├── auth/              인증·토큰·account 관련 pure/io 헬퍼
│       ├── cli/               커맨드별 실행 함수 + login-runner
│       ├── config/            설정 파일 로드/기본값
│       ├── services/          status-service + provider별 snapshot 빌더
│       └── index.js
├── provider-adapters/         provider별 인증/usage 로직
│   └── src/
│       ├── shared/            provider 중립 OAuth 헬퍼 ← 여기부터 확인
│       ├── codex/
│       └── claude/
└── schemas/                   공통 JSON Schema (usage snapshot / event)
```

**원칙**
- CLI는 얇게 유지. 복잡한 로직은 `services/` 또는 adapter에 둔다.
- `provider-adapters`는 이름처럼 `packages/agent`가 import하는 **어댑터**다. 반대 방향(`provider-adapters`가 `agent`를 import) 금지.
- `packages/schemas`는 두 패키지 모두에서 import 가능.

---

## 2. 공용 모듈 (shared/)

`packages/provider-adapters/src/shared/`는 provider에 독립적인 OAuth 헬퍼 모음이다. **provider 지식을 여기에 넣지 말 것.**

### 2.1 `shared/oauth-authorization-url.js`

```js
buildOAuthAuthorizationUrl({ endpoint, params })
```
- authorize URL 조립. `URLSearchParams` 순서 보존, null/undefined 스킵.
- provider별 extra 파라미터는 `params` 객체 속성으로 주입.
- Claude처럼 `code=true`같은 OAuth 스펙 외 key도 문제없이 통과.

### 2.2 `shared/oauth-token-endpoint.js`

```js
postToTokenEndpoint({ endpoint, body, encoding, extraHeaders, errorPrefix, fallbackRefreshToken, timeoutMs, fetchImpl })
liveExchangeDisabledError({ caller, endpoint, grantType, clientIdNote })
```
- token endpoint POST 공통 처리 (authorization_code / refresh_token 공용).
- `encoding: 'form' | 'json'` — Codex는 form, Claude는 json.
- `fallbackRefreshToken`: 응답에 `refresh_token`이 없을 때 기존 값 유지 (rotation 없는 경우).
- 응답은 정규화된 shape `{ accessToken, refreshToken, idToken, expiresIn, tokenType, scope }`로 반환.
- `liveExchangeDisabledError`는 `allowLiveExchange: false` guard용 표준 Error 빌더.

### 2.3 `shared/fetch-with-timeout.js`

```js
fetchWithTimeout(fetchImpl, input, init)
```
- `AbortController` 기반 네트워크 타임아웃 (기본 15초).
- `init.timeoutMs = 0`이면 비활성.
- 외부 `init.signal`도 함께 존중.
- **모든 provider 네트워크 호출은 이 헬퍼를 거쳐야 한다.** 직접 `fetch(...)`를 호출하지 말 것.

---

## 3. Provider adapter 패턴

Codex / Claude 두 예시를 그대로 참고하라.

### 3.1 파일 구성 (provider별)

```
packages/provider-adapters/src/{provider}/
├── {provider}-auth-constants.js         authorize/token endpoint, observed client_id, scopes
├── build-{provider}-authorization-url.js  shared.buildOAuthAuthorizationUrl 얇은 래퍼
├── exchange-{provider}-authorization-code.js  authorization_code grant (guard 포함)
├── refresh-{provider}-token.js          refresh_token grant (guard 포함)
├── fetch-{provider}-usage.js            usage endpoint + 응답 정규화
├── read-{provider}-credentials.js       로컬 credential 파일 reader (있는 경우)
└── index.js                             public export
```

### 3.2 authorize URL builder 패턴

```js
import { buildOAuthAuthorizationUrl } from '../shared/oauth-authorization-url.js';
import { FOO_AUTH } from './foo-auth-constants.js';

export function buildFooAuthorizationUrl({ callbackUrl, state, codeChallenge, codeChallengeMethod, ... }) {
  return buildOAuthAuthorizationUrl({
    endpoint: FOO_AUTH.authorizationEndpoint,
    params: {
      response_type: FOO_AUTH.responseType,
      client_id: clientId,
      redirect_uri: callbackUrl,
      // ... provider 고유 순서로 key 배치
    },
  });
}
```

**`params` 객체의 key 순서는 provider 바이너리가 실제로 보내는 순서와 맞춘다** (observed alignment). URLSearchParams가 순서를 보존하므로 의도대로 나간다.

### 3.3 Token exchange / Refresh 패턴

```js
import { postToTokenEndpoint, liveExchangeDisabledError } from '../shared/oauth-token-endpoint.js';

export async function exchangeFooAuthorizationCode({ code, callbackUrl, codeVerifier, allowLiveExchange = false, ... }) {
  if (!allowLiveExchange) {
    throw liveExchangeDisabledError({
      caller: 'exchangeFooAuthorizationCode',
      endpoint: FOO_AUTH.tokenEndpoint,
      grantType: 'authorization_code',
      clientIdNote: 'observed only',
    });
  }
  return postToTokenEndpoint({
    endpoint: FOO_AUTH.tokenEndpoint,
    encoding: 'form', // or 'json'
    body: { grant_type: 'authorization_code', code, ... },
    errorPrefix: 'Foo token exchange failed',
    fetchImpl,
  });
}
```

**절대 직접 `fetch()`로 token endpoint를 호출하지 말 것.** 모든 timeout/encoding/error 포맷이 `postToTokenEndpoint`에 통합되어 있다.

### 3.4 Usage fetcher 패턴

```js
import { fetchWithTimeout } from '../shared/fetch-with-timeout.js';

export async function fetchFooUsage(profile, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const response = await fetchWithTimeout(fetchImpl, FOO_USAGE_URL, { method: 'GET', headers, timeoutMs });
  // ... 응답 파싱 → SCHEMA_VERSION 기반 공통 snapshot 반환
}
```

응답 정규화는 provider별로 다르므로 각자 작성. `packages/schemas/` 타입을 준수.

### 3.5 Guard 패턴 (`allowLiveExchange`)

관찰값(observed) 기반으로 구현한 live 호출은 기본적으로 **차단**되어야 한다.
- 함수 기본값 `allowLiveExchange = false`
- CLI에서만 `--live-exchange` 플래그로 활성화
- 차단 시 `liveExchangeDisabledError`로 설명적 에러 반환

이 guard는 다음 조건이 모두 충족되기 전까지 유지한다:
1. client_id가 공식 확정됨
2. client_secret 요구 여부가 명확해짐

---

## 4. Services layer (status + provider registry)

### 4.1 구조

```
packages/agent/src/services/
├── status-service.js         얇은 진입점: loadConfig + registry 순회
├── provider-registry.js      PROVIDER_REGISTRY 배열 + runProviderSnapshots
├── codex-provider.js         Codex snapshot + auth resolver
└── claude-provider.js        Claude snapshot + auth resolver
```

### 4.2 Provider spec (registry용)

```js
{
  id: 'foo',                               // snapshot key
  getSnapshot: async (config) => ({ ... }) // config.providers.foo.enabled 여부도 내부에서 처리
}
```

**새 provider를 status에 추가하려면:**
1. `packages/provider-adapters/src/foo/` 디렉토리 생성 (파일 구성은 §3.1)
2. `packages/agent/src/services/foo-provider.js` 생성 — `getFooSnapshot(config)` async export
3. `services/provider-registry.js`의 `PROVIDER_REGISTRY`에 한 줄 추가
4. `config/default-config.js`에 `providers.foo.enabled` 기본값 추가
5. `status-command.js` / `doctor-command.js`에 출력 섹션 추가

### 4.3 Snapshot shape 관례

provider snapshot 최상위 구조:
```
{
  detected: boolean,                 // 계정 또는 credential 존재
  authSource: 'agent-store' | '{provider}-cli-import' | 'openclaw-import' | 'not-found',
  selectedAccount: object | null,
  usage: { source: 'stats-cache-json' | 'not-found', ... } | null,  // 로컬 캐시 기반 (옵션)
  networkUsage: SnapshotObject | null,                              // live endpoint 기반 (fetchXxxUsage 결과)
  // 기타 provider별 필드
}
```

network usage snapshot은 provider adapter의 `fetchXxxUsage`가 반환하는 정규화 결과를 그대로 담는다.

---

## 5. CLI layer

### 5.1 Login runner

새 provider에 OAuth login을 추가할 때는 `cli/login-runner.js`의 `runOAuthLoginFlow(spec, options)`를 쓴다. Provider 고유 분기(manual paste 등)는 커맨드 파일에 남기고, 공통 callback/exchange 흐름은 runner에 맡긴다.

Provider spec shape(`LoginProviderSpec`):
```js
{
  id, displayName, storeKey, accountKeyPrefix,
  callbackPath,           // Codex '/auth/callback', Claude '/callback'
  providerLabel,          // 브라우저 안내 prefix
  buildAuthorizationUrl,  // adapter의 build-* 함수 그대로
  exchangeCode,           // adapter의 exchange-* 함수를 { allowLiveExchange: true }로 감싼 것
  supportsMockCallback,   // true면 --live-exchange 없을 때 mock 저장
  saveMockAccount,        // supportsMockCallback=true일 때 필요
  note, endpointDescription, liveExchangeWarning,  // UX 문구
}
```

### 5.2 Option 파싱

`parseLoginOptions(args)`를 사용. 공통 플래그: `--port`, `--timeout`, `--no-open`, `--manual`, `--device`, `--live-exchange`.

---

## 6. Auth store / credential 처리

### 6.1 Store 위치

`~/.config/ai-usage-agent/auth.json` (권한 `0600`). 스키마는 `auth-store-schema.js`.

```
{
  providers: {
    'openai-codex': { accounts: [{ accountKey, tokens, email, ... }] },
    'claude':       { accounts: [{ ... }] }
  }
}
```

`storeKey`는 provider마다 다를 수 있다. 예:
- Codex: `openai-codex`
- Claude: `claude` (snapshot provider.id는 `anthropic-claude`로 다름 — `CLAUDE_AUTH.storeProvider` 참조)

### 6.2 Account key 규칙

```
{accountKeyPrefix}:{sub | email | 'live'}
```
- `accountKeyPrefix`는 snapshot의 `provider.id`와 같다 (`openai-codex`, `anthropic-claude`).
- identity는 `extractAccountIdentity` 결과 중 `accountId`(JWT sub) 우선, 없으면 `email`, 둘 다 없으면 `'live'`.

### 6.3 Import 경로

각 provider에 대해 두 import 경로가 공존할 수 있다:
- `auth import openclaw` — 기존 OpenClaw auth-profiles.json 흡수
- `auth import {provider}` — provider CLI credential을 agent-store에 복사

Claude는 `~/.claude/.credentials.json`을 `resolveImportedClaudeSnapshot()`로 읽는다. 동일 provider에 대해 agent-store(live) + {provider}-cli-import(복제) 둘 다 존재할 수 있고, `resolveClaudeAccount`가 우선순위를 적용한다.

### 6.4 claude-imported-account.js

Claude CLI credential 파일을 agent-store에 주입할 때는 `packages/agent/src/auth/claude-imported-account.js`의 3단계를 거친다:
```
createClaudeImportedAccountPayload → prepareClaudeImportedAccount → importClaudeAccountIntoStore
```
이 세 함수는 같은 파일에 있고, pure transform — store 저장은 `auth-import-command.js`가 담당.

---

## 7. 네이밍 / 파일 분할 규칙

### 7.1 파일 크기 / 응집도

- **지나친 파일 분할 지양**. "1 함수 1 파일"로 쪼개지 말 것.
- 같은 도메인 / 같은 호출 체인의 pure helper는 한 파일에 모은다 (예: `claude-imported-account.js`에 3개 함수 병합).
- 응집도가 낮아지면 300~400 LOC 근처에서 분리 검토 (status-service는 388 → 49로 분리한 선례).

### 7.2 네이밍

- 파일명: `kebab-case`.
- 함수명: `camelCase`, 역할 동사로 시작 (`build`, `resolve`, `fetch`, `parse`, `read`).
- provider 상수: `UPPER_SNAKE` (`CODEX_AUTH`, `CLAUDE_AUTH`).
- **provider 이름은 일관되게 사용.** Codex → `codex` / `openai-codex`, Claude → `claude` / `anthropic-claude`. 혼용 금지.

### 7.3 Observed vs verified

관찰된 값과 검증된 값을 **주석 / 문서에서 구분**한다.
- `verified`: 실 네트워크 호출 또는 공식 문서로 확인된 값
- `observed`: 바이너리 strings / 로컬 파일에서 관찰만 된 값 — 변경 가능성 있음

`{provider}-auth-constants.js`의 상수는 observed 레벨로 간주되며, 주석에 출처(파일 경로 / 버전)를 명시한다.

---

## 8. 테스트 규칙

### 8.1 프레임워크

`node --test` (Node.js 내장). 외부 test runner 추가 금지.

### 8.2 파일 위치

`packages/{pkg}/test/**/*.test.js` — src 디렉토리 구조를 그대로 반영.

### 8.3 커버리지 관례

- **Pure function은 전수 테스트.** guard/edge case 포함.
- **네트워크 호출**은 `fetchImpl` 주입 mock으로 테스트. 실제 HTTP 금지.
- **CLI 명령**은 stdout 캡처 대신 순수 helper(`formatXxxSection`, `parseXxxOptions`)를 export해서 테스트.
- **파일 I/O**가 있는 함수는 `os.tmpdir()`에 임시 파일 생성 후 정리.

### 8.4 테스트 이름

```js
describe('functionName', () => {
  it('동사형으로 동작 설명', ...)
})
```
한글/영문 혼용 OK. "동작 / 결과" 관점으로 서술.

---

## 9. 커밋 / PR / 브랜치

자세한 내용은 `CONTRIBUTING.md`.

요약:
- 커밋: `type(scope): 한글 설명`
- type: `feat` / `fix` / `refactor` / `docs` / `chore` / `ci` / `test` / `perf`
- PR 제목: `[type] 한글 요약`
- 브랜치: `feat/xxx`, `fix/xxx`, `refactor/xxx`, `chore/xxx`, `docs/xxx`
- 브랜치 흐름: 작업 → dev → main

**주의**: 스택 PR을 쓸 때는 각 PR이 **dev로 직접** 머지되도록 순서를 조정해야 한다. base → head 흐름이 dev가 아니면 내용이 dev에 반영되지 않을 수 있다 (경험 사례: PR #17/18 → auth/usage 브랜치로만 들어가고 dev는 PR #19로 다시 올려야 했음).

---

## 10. Anti-patterns (하지 말 것)

- `fetch(...)`를 직접 호출 → `fetchWithTimeout` 또는 `postToTokenEndpoint` 사용
- provider 지식을 `shared/`에 넣음 → provider는 spec/params로 주입
- "1 파일 1 함수"로 파일 수 폭증
- token을 console.log로 출력
- guard(`allowLiveExchange`) 기본값을 true로 변경 (공식 확정 전까지)
- OpenClaw에 새로운 의존 추가 (agent는 독립)
- agent → provider-adapters 반대 방향 import
- observed 값을 문서에 "verified"로 기록

---

## 11. 새 기능 추가 체크리스트

**새 provider 추가할 때**:
- [ ] `provider-adapters/src/{provider}/` 전체 파일 작성 (§3.1)
- [ ] `agent/src/services/{provider}-provider.js` 작성
- [ ] `provider-registry.js` 등록
- [ ] `config/default-config.js`에 `providers.{provider}.enabled` 추가
- [ ] CLI 출력(`status-command`, `doctor-command`)에 섹션 추가
- [ ] `auth-login-command`의 dispatcher에 provider 브랜치 추가 + provider spec 선언
- [ ] observed 값은 `docs/provider-notes.md`에 출처와 함께 기록
- [ ] 테스트: constants / build-url / exchange / refresh / fetch / snapshot 계열 전부

**새 shared 헬퍼 추가할 때**:
- [ ] `packages/provider-adapters/src/shared/` 아래 파일 추가
- [ ] `shared/index.js`에서 export
- [ ] provider 지식 유입 여부 재점검 (`codex`, `claude` 같은 식별자가 파일에 있으면 잘못된 위치)
- [ ] 테스트: pure 함수면 전수 / IO 섞이면 injection 기반

**새 CLI 커맨드 추가할 때**:
- [ ] `packages/agent/src/cli/{name}-command.js`
- [ ] `run-cli.js`에 dispatch 추가
- [ ] options 파싱은 `parseLoginOptions` 스타일 (인자 파서는 pure, test 가능)
- [ ] 출력 형식 helper(`formatXxxSection`)를 export해 test

---

## 12. 작업 전 확인

Claude 세션 시작 시:
1. `git status` / `git log --oneline -10` — 현재 상태
2. `gh issue list` / `gh pr list` — 진행 중 항목
3. 이 문서(`docs/codebase-guide.md`)와 관련 섹션
4. 작업 대상 파일의 기존 패턴 확인 후 일관되게 작성

**작업 후 확인**:
- [ ] `npm test` pass
- [ ] CLI smoke (`status`, `doctor`) 이상 없음
- [ ] 새 파일이 §7 네이밍과 §8 테스트 위치 규칙에 맞음
- [ ] 커밋 메시지가 `type(scope): ` 규격 맞음
- [ ] PR 생성은 **사용자 명시 요청 이후**에만
