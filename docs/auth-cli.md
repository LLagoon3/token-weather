# Auth CLI 인터페이스

🌐 [English](./auth-cli.en.md) · **한국어**

`token-weather`의 인증 관련 CLI 명령 집합과 운영 정책을 정리한다.

## 명령 구조

```text
token-weather auth <subcommand> [provider] [options]
token-weather doctor [provider] [options]
```

## login

```bash
token-weather auth login codex   [--manual] [--no-open] [--port N] [--timeout SEC] [--mock]
token-weather auth login claude  [--manual] [--no-open] [--port N] [--timeout SEC] [--mock]
```

동작:

- localhost callback OAuth (PKCE S256 + state) 기반
- **기본 경로는 실제 OAuth 토큰 교환** — provider token endpoint에 POST 후 access/refresh token 저장
- `--mock` 옵션 시 token endpoint 호출 없이 mock 계정만 저장 (테스트/실험용)
- 성공 시 agent-store(`auth.json`)에 토큰 저장

옵션:

- `--mock`: 실제 token endpoint 호출 없이 mock 계정만 저장 (테스트/실험)
- `--manual`: callback URL/code 수동 붙여넣기 (SSH/컨테이너/포트 충돌 환경)
- `--no-open`: 브라우저 자동 실행 안 함
- `--port N`: localhost callback 포트 지정 (정수 0~65535). 범위를 벗어나면 경고를 출력하고 login을 중단한다.
- `--timeout SEC`: callback 대기 시간 (기본 120초). 양의 정수여야 하며 아니면 경고 후 중단.
- `--label <name>`: 저장될 계정에 라벨을 붙인다. 이후 `--account <name>`으로 참조 가능.
- `--keep-legacy`: 새 토큰과 같은 sub/email을 가진 기존 legacy accountKey를 자동 제거하지 않고 유지한다. 기본값은 자동 정리.

provider별 callback 경로:

- Codex: `/auth/callback`
- Claude: `/callback`

## list

```bash
token-weather auth list
token-weather auth list openai-codex
token-weather auth list claude
```

출력 필드: provider, accountKey, email, label, source, authType, status, mock 여부, refresh 가능 여부, expiresAt, createdAt, updatedAt.

Claude는 agent-store에 저장된 계정과 `~/.claude/.credentials.json` import source 양쪽을 표시한다.

## logout

```bash
token-weather auth logout <provider>
token-weather auth logout <provider> --account <email | accountKey | label>
```

- 로컬 auth store에서 해당 계정 제거
- `--account`는 email / accountKey / label 중 하나로 지정 가능 (case-insensitive)
- provider 측 revoke endpoint 호출은 미구현 (후속)

## import

```bash
token-weather auth import claude     # ~/.claude/.credentials.json → agent-store
```

- 현재 지원되는 import provider는 `claude` 한 가지. 다른 provider 입력 시 `import는 현재 claude만 지원합니다`로 종료한다.
- runtime 기본 경로가 아닌 **migration/흡수** 용도
- Claude import는 CLI credential을 그대로 복사하는 빠른 경로 (네트워크 호출 없음)
- OpenClaw auth-profiles 데이터는 `auth import` 명령으로는 흡수되지 않지만, status snapshot이 `agent-store`에 Codex 계정이 없을 때 자동으로 `openclaw-import` source로 fallback해 read-only로 노출된다 (`docs/auth-architecture.md` Credential source 우선순위).

## doctor

```bash
token-weather doctor                        # 공통 상태 점검
token-weather doctor codex                  # Codex 계정/refresh 가능성 점검
token-weather doctor codex  --refresh-live  # 실제 refresh POST
token-weather doctor codex  --account <id>  # 특정 계정 지정
token-weather doctor claude                 # Claude credential + live usage 점검
token-weather doctor claude --refresh-live  # Claude refresh POST
token-weather doctor claude --refresh-live --account <id>  # 특정 계정 지정
```

점검 항목:

- auth store / credential 파일 존재 여부
- 선택될 계정 (agent-store > import 우선순위)
- expiresAt 만료 임박 여부
- refresh 가능 여부 (refreshToken 존재 + mock 아님)
- live usage endpoint 응답 요약
- `--refresh-live` 시 실제 refresh 호출 + 결과 표시

`doctor --refresh-live`는 수동 진단/검증용 경로다. `status` / `usage`의 자동 refresh와는 별도로 동작한다.

### `--dedupe` (issue #37)

같은 OAuth subject (sub 또는 email) 를 가진 stale 레코드를 store 에서 정리한다. login 시점 자동 정리(PR #38) 이전에 누적된 legacy accountKey, 또는 id_token 파싱이 부분적으로 실패했던 케이스를 retroactive 로 청소.

```bash
token-weather doctor codex  --dedupe                              # dry-run: 후보만 출력
token-weather doctor codex  --dedupe --apply                      # 실제 제거 반영
token-weather doctor codex  --dedupe --backfill-account-id        # backfill 후보까지 dry-run
token-weather doctor codex  --dedupe --backfill-account-id --apply  # 실제 반영
token-weather doctor claude --dedupe ...                          # 동일 옵션
```

동작:

- `--dedupe` 단독: 중복 그룹 + 유지/제거 후보를 콘솔에 출력만 (auth.json 변경 없음)
- `--dedupe --apply`: 그룹마다 primary 1개를 유지하고 나머지를 `removeProviderAccount` 로 제거
- `--backfill-account-id`: `accountId` 가 빈 레코드 중 `raw.idToken` 의 `sub` 로 채울 수 있는 후보를 함께 처리

primary 선택 우선순위 (낮을수록 keep):

1. `accountId` 가 set 된 쪽
2. `status === 'active'` (vs `disabled`)
3. `source === 'agent-store'` (vs `claude-cli-import` / `manual` 등)
4. `updatedAt` 가 가장 최근
5. `accountKey` lexicographic (안정 정렬)

필터:

- `source === 'manual'` 또는 `raw.mock === true` 인 레코드는 그룹화 대상에서 제외
- 합성 email (`live-*@codex.openai.com`) 은 email 기반 매칭에서 배제

상호작용:

- `--account` 와 `--dedupe` 를 동시 지정하면 `--account` 는 무시되고 모든 계정을 검사한다 (warning 출력)
- `--dedupe` 와 `--refresh-live` 가 동시에 오면 `--dedupe` 가 우선되어 dedupe 만 실행

안전 가이드:

- 항상 dry-run 먼저 (`--dedupe` 단독) 실행해 후보를 검토 후 `--apply`
- 한 번 제거된 레코드는 자동 복구 안 됨 — 필요하면 사전에 `~/.config/token-weather/auth.json` 백업
- v1 은 `doctor codex` / `doctor claude` 별도 실행 — provider 통합 dedupe 는 미지원

## 포트 충돌 정책 (Codex)

- 기본 포트: `1455`
- 충돌 시 `1456`, `1457` 순으로 최대 3회 시도
- 3회 모두 실패 → manual paste 모드 자동 전환
- `--port` 명시 시 해당 포트만 시도, 실패 시 에러

Claude는 동일한 `resolveCallbackPort` 로직을 사용하되 callback path가 다르다.

## status / usage 자동 refresh 정책

- 대상은 **agent-store real account**만이다.
- `expiresAt`이 이미 지난 access token은 provider 호출 전에 preflight refresh를 먼저 시도한다.
- 첫 provider 응답이 인증성 실패(`status.bucket === 'auth'`)로 정규화되면 refresh 후 1회만 다시 시도한다.
- refresh 실패는 해당 계정의 usage 실패로 남고, 다른 계정 조회는 계속 진행한다.
- import source(`openclaw-import`, `claude-cli-import`)는 store 갱신 경로가 없으므로 자동 refresh 대상에서 제외한다.
- source precedence는 unfiltered 기준으로 먼저 결정하고, 실제 조회 대상은 선택된 source 위에 `--account` / config 필터를 다시 적용한다.

## Multi-account 정책

- 계정 1개: 자동 선택
- 계정 여러 개: `lastUsedAt`이 가장 최근인 active 계정 선택
- `--account`로 명시 override 가능 (email 또는 accountKey)

## UX 원칙

- 기본 명령은 최대한 짧게
- 세부 제어는 옵션으로 열기
- 실패 시 단순한 에러 대신 다음 행동을 안내
- headless/원격 환경용 fallback 경로를 명확히 제공
- multi-account는 자동 + 명시 override

## 예시 시나리오

### 데스크톱: Claude 독립 OAuth

```bash
token-weather auth login claude
# authorize URL 출력 → 브라우저에서 직접 열기
# 로그인 완료 → localhost callback 수신 → token 저장
token-weather status
```

### 데스크톱: Claude 빠른 import

```bash
# Claude CLI로 이미 로그인된 상태에서
token-weather auth import claude
token-weather status
```

### SSH/원격: Codex manual

```bash
token-weather auth login codex --manual --no-open
# 안내에 따라 brower로 URL 수동 오픈 → 반환 URL 전체 붙여넣기
```

## 아직 미정인 부분

- client_secret 요구 여부 (Codex / Claude 모두)
- revoke endpoint 지원 범위 (logout 시 서버측 무효화)
- device code flow 도입 여부
- keychain 연동
- `auth import openclaw` 명령 복구 여부 — 현재 미구현(claude만 지원). status snapshot은 fallback source로 OpenClaw 데이터를 read만 하고 있고, 명령형 import 경로는 후속 결정 사항.
