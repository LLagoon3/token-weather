# Token Weather

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/%40token-weather%2Fcli.svg)](https://www.npmjs.com/package/@token-weather/cli)
[![CI](https://github.com/LLagoon3/token-weather/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/LLagoon3/token-weather/actions/workflows/ci.yml)
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
token-weather config init                              # ~/.config/ai-usage-agent/config.json 생성
token-weather auth login claude --live-exchange        # 브라우저 → localhost callback (PKCE + state 검증)
token-weather status                                   # 인증 / 사용량 / 만료까지 한 번에
token-weather status --json | jq                       # 자동화/대시보드용 정규화 JSON
```

브라우저 자동 callback이 어려운 환경(SSH, 컨테이너, 포트 충돌)에서는 `--manual`을 사용하면 콘솔에 노출된 OAuth URL을 다른 머신에서 열고 callback URL을 paste하는 흐름이 됩니다:

```bash
token-weather auth login claude --manual --live-exchange
```

`--live-exchange`를 빼면 mock/생략 경로로 동작 (실 토큰 저장 안 함).

## Demo

<!-- TOKEN_WEATHER_DEMO_PLACEHOLDER: docs/assets/demo.svg는 후속 이슈에서 추가 예정.
     녹화 방법: bash scripts/record-demo.sh (asciinema + agg 필요).
     녹화는 격리된 HOME에서 자동 수행, SVG 결과물에 토큰 누출 grep 검증까지 포함. -->

`token-weather` 첫 1분 흐름은 `bash scripts/record-demo.sh`로 직접 녹화할 수 있습니다 ([asciinema](https://asciinema.org/) + [agg](https://github.com/asciinema/agg) 필요). 녹화는 격리된 HOME에서 수행되고, SVG 결과물은 publish 전 토큰 패턴 자동 검증을 거칩니다.

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

`--live-exchange` 없이 `auth login`은 mock 저장만 수행 (실제 token 호출 차단). `--label`로 저장된 계정에 친화적 이름 부여 → 이후 `--account <label>`로 참조.

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

## 보안 신고

OAuth token 같은 자격증명을 다루는 도구이므로, 보안 이슈는 공개 이슈에 작성하지 말고 [SECURITY.md](./SECURITY.md)에 안내된 비공개 채널로 신고해 주세요. 행동 강령은 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)를 따릅니다.

## 라이선스

[Apache License 2.0](./LICENSE). PR을 제출하시면 본인의 기여가 동일 라이선스로 제공됨에 동의한 것으로 간주됩니다 (자세한 내용은 [CONTRIBUTING.md §8](./CONTRIBUTING.md)).

## Contributing

기여 환영합니다. PR 작성 / 브랜치 / 커밋 규칙은 [CONTRIBUTING.md](./CONTRIBUTING.md), 코드 패턴 / 네이밍 / 테스트 / anti-patterns는 [docs/codebase-guide.md](./docs/codebase-guide.md)를 참고해 주세요.

```bash
npm test              # 전체 테스트 (node:test 내장 러너)
npm run test:agent    # agent 패키지만
npm run test:adapters # provider adapters만
npm run test:schemas  # schemas 패키지만
```

진행 중인 작업은 [Issues](https://github.com/LLagoon3/token-weather/issues)에서 추적합니다.

### 추가 문서

- [docs/architecture.md](./docs/architecture.md) — 고수준 구조 요약
- [docs/auth-architecture.md](./docs/auth-architecture.md) — 인증 / token / source 우선순위 상세
- [docs/auth-cli.md](./docs/auth-cli.md) — auth CLI 명령 / 정책
- [docs/cli-json-output.md](./docs/cli-json-output.md) — `--json` stable contract + redaction 규약
- [docs/provider-notes.md](./docs/provider-notes.md) — provider별 observed endpoint / client_id
- [docs/codebase-guide.md](./docs/codebase-guide.md) — 기여자용 상세 가이드 (패키지 레이아웃, shared 헬퍼, 새 기능 체크리스트)
