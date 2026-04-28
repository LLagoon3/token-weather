# Auth CLI 인터페이스

`token-weather`의 인증 관련 CLI 명령 집합과 운영 정책을 정리한다.

## 명령 구조

```text
token-weather auth <subcommand> [provider] [options]
token-weather doctor [provider] [options]
```

## login

```bash
token-weather auth login codex   [--live-exchange] [--manual] [--no-open] [--port N] [--timeout SEC]
token-weather auth login claude  [--live-exchange] [--port N] [--timeout SEC]
```

동작:

- localhost callback OAuth (PKCE S256 + state) 기반
- 기본 경로는 token exchange 없이 **mock 저장**
- `--live-exchange` 시 provider token endpoint에 실제 POST (실험적, guard 해제)
- 성공 시 agent-store(`auth.json`)에 access/refresh token 저장

옵션:

- `--live-exchange`: 실제 token 교환 시도. 실패 시 mock fallback 없이 에러 표시
- `--manual` (Codex): callback URL/code 수동 붙여넣기
- `--no-open` (Codex): 브라우저 자동 실행 안 함
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

출력 필드: provider, accountKey, email, label, source, authType, status, mock 여부, liveToken 여부, refresh 가능 여부, expiresAt, createdAt, updatedAt.

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

## Guard 정책 (`allowLiveExchange`)

- `exchangeCodexAuthorizationCode`, `refreshCodexToken`, `exchangeClaudeAuthorizationCode`, `refreshClaudeToken` 모두 기본 guarded
- CLI의 `--live-exchange` / `--refresh-live`를 통해서만 guard 해제
- 실패 시 mock fallback 없이 에러 노출 (사용자 혼동 방지)
- 관찰값(observed client_id, endpoint)이 변경될 때 자동 재시도로 피해가 커지는 것 방지

guard를 해제할 시점:

1. client_id 공식 확정
2. client_secret 요구사항 명확화
3. 장기 안정성 확인

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
token-weather auth login claude --live-exchange
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
