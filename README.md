# Token Weather

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/%40token-weather%2Fcli.svg)](https://www.npmjs.com/package/@token-weather/cli)
[![CI](https://github.com/LLagoon3/ai-usage-agent/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/LLagoon3/ai-usage-agent/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/%40token-weather%2Fcli.svg)](https://nodejs.org/)

> **Local CLI dashboard for AI service usage and OAuth credentials.**
> 로컬에서 여러 AI 서비스(Codex / Claude)의 사용량과 인증 상태를 한 번에 확인하는 CLI. 토큰을 외부 서버로 보내지 않습니다.

## Install

```bash
# 한 번 실행 (설치 없이)
npx @token-weather/cli status

# 글로벌 설치 후 사용
npm install -g @token-weather/cli
token-weather --help
```

첫 명령:

```bash
token-weather config init                # ~/.config/ai-usage-agent/config.json 생성
token-weather auth login claude          # OAuth 로그인 (PKCE + localhost callback)
token-weather status                     # 인증 / 사용량 / 만료까지 한 번에
token-weather status --json | jq         # 자동화/대시보드용 정규화 JSON
```

## What & Why

- **무엇**: AI 도구의 OAuth credential과 사용량 window를 로컬에서 통합 조회하는 CLI. Codex(OpenAI) / Claude(Anthropic) 두 provider 운영 중.
- **왜**: 다른 대시보드들은 토큰을 외부 서버로 보내거나 별도 auth 서비스에 의존. Token Weather는 **자체 broker + 로컬 credential store**로 동작 — 토큰이 머신을 떠나지 않습니다.
- **어떤 점이 다른가**:
  - **Multi-account**: 한 provider에 여러 계정 저장, 병렬 조회, label 부여
  - **자동 refresh**: 만료된 access token은 provider 호출 전 preflight refresh, auth 실패 시 1회 재시도
  - **`status --json` stable contract**: 토큰 redaction 보장된 정규화 출력 — 외부 대시보드/수집기가 직접 소비 가능 ([docs/cli-json-output.md](./docs/cli-json-output.md))
  - **observed vs verified 구분**: provider 바이너리 관찰값에 의존하는 endpoint는 `--live-exchange` guard 뒤에서만 호출 — 실수로 실 토큰 호출이 반복되지 않도록

## 지원 provider

| Provider | OAuth 로그인 | Usage endpoint | Refresh | Status |
| --- | --- | --- | --- | --- |
| Codex (OpenAI) | ✓ `auth login codex --live-exchange` | `wham/usage` | ✓ | 운영 중 |
| Claude (Anthropic) | ✓ `auth login claude --live-exchange` | `oauth/usage` | ✓ | 운영 중 |

provider별 observed endpoint / client_id 상세는 [docs/provider-notes.md](./docs/provider-notes.md).

## 명령

전체 명령은 `token-weather <command> --help`로 확인. 요약:

```bash
token-weather status [--account <id>] [--provider <id>] [--json]   # 사용량/인증 한 번에
token-weather usage  [...]                                         # status와 동일 출력 (alias)
token-weather doctor [codex|claude] [--refresh-live] [--account]   # 환경/refresh 진단
token-weather auth login <codex|claude> [--live-exchange] [--label]
token-weather auth list   [provider]
token-weather auth logout <provider> [--account]
token-weather auth import claude                                   # Claude CLI credential 흡수
token-weather config init                                          # 설정 파일 생성
```

`--live-exchange` 없이 \`auth login\`은 mock 저장만 수행 (실제 token 호출 차단). `--label`로 저장된 계정에 친화적 이름 부여 → 이후 `--account <label>`로 참조.

## JSON 출력 (자동화)

`status` / `usage`는 `--json`으로 정규화된 JSON 한 줄을 stdout에 출력합니다 — 토큰 redaction 보장. 외부 대시보드/수집기에서 그대로 소비 가능.

```bash
token-weather status --json | jq '.providers[0]'
```

shape / redaction 규약 / 한계: [docs/cli-json-output.md](./docs/cli-json-output.md).

## 보안 원칙

- localhost callback은 `127.0.0.1`에만 bind, PKCE S256 + state 검증
- access / refresh / id token은 로그/JSON 모두에서 redact (`SENSITIVE_KEYS` 기반)
- raw prompt / response / transcript는 어떤 경우에도 외부로 보내지 않음
- observed 값(`client_id`, endpoint)은 `--live-exchange` guard 뒤에서만 실 호출

상세: [docs/auth-architecture.md](./docs/auth-architecture.md), [SECURITY.md](./SECURITY.md).

## 기여자용 참고 문서

- `docs/codebase-guide.md` — 다른 Claude 세션 / 기여자가 구조적 일관성을 유지하며 작업할 수 있도록 정리한 상세 가이드 (패키지 레이아웃, shared/ 헬퍼 사용법, provider adapter 패턴, 네이밍 / 테스트 / 커밋 규칙, anti-patterns, 새 기능 체크리스트).
- `docs/architecture.md` — 고수준 구조 요약.
- `docs/auth-cli.md` — CLI 명령 / 정책.
- `docs/cli-json-output.md` — `status` / `usage` `--json` 출력 contract와 redaction 규약.
- `docs/provider-notes.md` — provider별 observed endpoint / client_id.
- `CONTRIBUTING.md` — 브랜치 / 커밋 / PR 규칙.

## 개발 / 테스트

```bash
npm test              # 전체 테스트 (현재 482개)
npm run test:agent    # agent 패키지만
npm run test:adapters # provider adapters만
```

테스트 레이아웃:
- `packages/provider-adapters/test/shared/` — 공용 OAuth / usage snapshot / fetch helper
- `packages/provider-adapters/test/{codex,claude}/` — provider adapter
- `packages/agent/test/auth/` — auth store / token claims / callback / imported-account 등
- `packages/agent/test/cli/` — CLI 명령별 pure formatter / parser
- `packages/agent/test/services/` — registry + provider snapshot 빌더
- `packages/agent/test/integration/` — bin spawn smoke

CI(`.github/workflows/ci.yml`):
- pull_request에서는 항상 실행
- push는 main / dev 브랜치에서만 (feature 브랜치 push는 PR이 열리면 한 번만 실행)
- concurrency 그룹으로 같은 브랜치에 연속 push 시 이전 run 자동 취소

## 작업 / 협업 규칙

- 브랜치 흐름: `작업 브랜치 → dev → main`
- 커밋: `type(scope): 한글 설명` (type: feat / fix / refactor / docs / chore / ci / test / perf)
- PR 제목: `[type] 한글 요약`
- PR 본문: 요약 / 변경 내용 / 이유 / 영향 범위 / 테스트 / 리뷰 포인트

상세: `CONTRIBUTING.md` 참고.

## 다음 작업 후보

- Codex/Claude 네트워크 호출 timeout/abort (이슈 #7)
- Claude Phase 4 — session cookie fallback (이슈 #14, 옵션)
- code-base 구조 리팩터 (중복되는 provider adapter shape 통합)
- keychain 연동 / device code flow / revoke endpoint 조사

## 보안 신고

OAuth access/refresh/id token 같은 자격증명을 다루는 도구이므로, 보안 이슈는 공개 이슈에 작성하지 말고 [SECURITY.md](./SECURITY.md)에 안내된 비공개 채널로 신고해 주세요. 토큰을 실수로 노출했을 때 즉시 revoke하는 절차도 같은 문서에 정리되어 있습니다.

행동 강령은 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)를 따릅니다.

## 라이선스

[Apache License 2.0](./LICENSE) — 자세한 내용은 LICENSE 파일을 참고하세요.

기여하신 내용은 동일 라이선스로 제공됨에 동의한 것으로 간주됩니다 (자세한 내용은 [CONTRIBUTING.md §8](./CONTRIBUTING.md)).
