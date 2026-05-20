# Token Weather

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/%40token-weather%2Fcli.svg)](https://www.npmjs.com/package/@token-weather/cli)
[![CI](https://github.com/LLagoon3/token-weather/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LLagoon3/token-weather/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/%40token-weather%2Fcli.svg)](https://nodejs.org/)

> **Local CLI dashboard for AI service usage and OAuth credentials.**
> 로컬에서 여러 AI 서비스(Codex / Claude)의 사용량과 인증 상태를 한 번에 확인하는 CLI. **OAuth 토큰은 외부 서버로 보내지 않습니다** (옵션 `@token-weather/telegram` 활성화 시에도 봇 토큰 / OAuth 토큰은 로컬, 사용량 메타데이터만 Telegram 서버 경유 — [상세](./docs/telegram-bot.md#보안-모델)).

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
token-weather config init                              # ~/.config/token-weather/config.json 생성
token-weather auth login claude                        # 브라우저 → localhost callback (PKCE + state 검증) → 실제 OAuth 토큰 저장
token-weather status                                   # 인증 / 사용량 / 만료까지 한 번에
token-weather status --json | jq                       # 자동화/대시보드용 정규화 JSON
```

브라우저 자동 callback이 어려운 환경(SSH, 컨테이너, 포트 충돌)에서는 `--manual`을 사용하면 콘솔에 노출된 OAuth URL을 다른 머신에서 열고 callback URL을 paste하는 흐름이 됩니다:

```bash
token-weather auth login claude --manual
```

테스트 / 실험 환경에서 실제 token endpoint 호출 없이 mock 계정만 저장하려면 `--mock` 옵션을 추가합니다 (default 는 실제 OAuth 토큰 교환).

## Demo

<!-- TOKEN_WEATHER_DEMO_PLACEHOLDER: docs/assets/demo.svg는 후속 이슈에서 추가 예정.
     녹화 방법: bash scripts/record-demo.sh (asciinema + agg 필요).
     녹화는 격리된 HOME에서 자동 수행, SVG 결과물에 토큰 누출 grep 검증까지 포함. -->

`token-weather` 첫 1분 흐름은 `bash scripts/record-demo.sh`로 직접 녹화할 수 있습니다 ([asciinema](https://asciinema.org/) + [agg](https://github.com/asciinema/agg) 필요). 녹화는 격리된 HOME에서 수행되고, SVG 결과물은 publish 전 토큰 패턴 자동 검증을 거칩니다.

## What & Why

- **무엇**: AI 도구의 OAuth credential과 사용량 window를 로컬에서 통합 조회하는 CLI. Codex(OpenAI) / Claude(Anthropic) 두 provider 운영 중.
- **왜**: 다른 대시보드들은 토큰을 외부 서버로 보내거나 별도 auth 서비스에 의존. Token Weather는 **자체 broker + 로컬 credential store**로 동작 — **OAuth 토큰이 머신을 떠나지 않습니다**. 옵션 `@token-weather/telegram` 사용 시에도 token 자체는 로컬, 사용량 / 계정 label 메타데이터만 Telegram 서버 경유 ([상세](./docs/telegram-bot.md#보안-모델)).
- **어떤 점이 다른가**:
  - **Multi-account**: 한 provider에 여러 계정 저장, 병렬 조회, label 부여
  - **자동 refresh**: 만료된 access token은 provider 호출 전 preflight refresh, auth 실패 시 1회 재시도
  - **`status --json` stable contract**: 토큰 redaction 보장된 정규화 출력 — 외부 대시보드/수집기가 직접 소비 가능 ([docs/cli-json-output.md](./docs/cli-json-output.md))
  - **observed `client_id` 사용**: provider 바이너리 관찰값을 그대로 사용 (공식 등록된 OAuth client 가 아님). 본 도구의 모든 publish 자체는 npm Trusted Publishing OIDC + SLSA provenance 로 검증 — 외부에서 supply chain 검증 가능

## 지원 provider

| Provider           | OAuth 로그인          | Usage endpoint | Refresh | Status  |
| ------------------ | --------------------- | -------------- | ------- | ------- |
| Codex (OpenAI)     | ✓ `auth login codex`  | `wham/usage`   | ✓       | 운영 중 |
| Claude (Anthropic) | ✓ `auth login claude` | `oauth/usage`  | ✓       | 운영 중 |

provider별 observed endpoint / client_id 상세는 [docs/provider-notes.md](./docs/provider-notes.md).

## 명령

전체 명령은 `token-weather <command> --help`로 확인. 요약:

```bash
token-weather status [--account <id>] [--provider <id>] [--json]   # 사용량/인증 한 번에
token-weather usage  [...]                                         # status와 동일 출력 (alias)
token-weather doctor [codex|claude] [--refresh-live] [--account]   # 환경/refresh 진단
token-weather auth login <codex|claude> [--mock] [--manual] [--label]
token-weather auth list   [provider]
token-weather auth logout <provider> [--account]
token-weather auth import claude                                   # Claude CLI credential 흡수
token-weather config init                                          # 설정 파일 생성
token-weather telegram setup    # Telegram 봇 페어링 + OS service 안내 (옵션 패키지)
token-weather telegram start    # Telegram 봇 daemon (foreground, Ctrl+C 종료)
token-weather telegram check    # Telegram 설정 / token / linger 진단
```

default `auth login` 은 실제 OAuth 토큰 교환을 수행합니다. `--mock` 옵션 시 token endpoint 호출 없이 mock 계정만 저장 (테스트/실험용). `--label` 로 저장된 계정에 친화적 이름 부여 → 이후 `--account <label>` 로 참조.

## Telegram 봇 (옵션)

핸드폰 / 다른 데스크탑에서 `status` / `usage` / `doctor` / `auth list` 명령을 원격 호출하고 싶다면 별도 패키지 `@token-weather/telegram` 을 추가 설치합니다. token-weather 가 시스템 service 파일을 직접 만들지 않고, 사용자 동의가 필요한 명령 블록만 print 합니다 (UX 절충안).

```bash
npm install -g @token-weather/telegram   # 옵션 패키지
token-weather telegram setup             # 봇 토큰 + 페어링 + OS service 안내
token-weather telegram start             # daemon 실행 (또는 setup 끝의 systemd / launchd / Task Scheduler 사용)
```

상세 / 보안 모델 / OS service 수동 등록 / FAQ: [docs/telegram-bot.md](./docs/telegram-bot.md).

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
- observed `client_id` 는 v0.2.0 부터 가드 없이 사용 (publish 자체는 npm Trusted Publishing OIDC + SLSA provenance 로 검증). 공식 client 등록 전까지는 실험적 운영

상세: [docs/auth-architecture.md](./docs/auth-architecture.md), [SECURITY.md](./SECURITY.md).

## 보안 신고

OAuth token 같은 자격증명을 다루는 도구이므로, 보안 이슈는 공개 이슈에 작성하지 말고 [SECURITY.md](./SECURITY.md)에 안내된 비공개 채널로 신고해 주세요. 행동 강령은 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)를 따릅니다.

## 라이선스

[Apache License 2.0](./LICENSE). PR을 제출하시면 본인의 기여가 동일 라이선스로 제공됨에 동의한 것으로 간주됩니다 (자세한 내용은 [CONTRIBUTING.md §9](./CONTRIBUTING.md)).

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

빠른 entry point — [docs/INDEX.md](./docs/INDEX.md) (카테고리별).

**외부 사용자용** (npm install 후 직접 참고):

- [docs/architecture.md](./docs/architecture.md) — 고수준 구조 요약
- [docs/auth-architecture.md](./docs/auth-architecture.md) — 인증 / token / source 우선순위 상세
- [docs/auth-cli.md](./docs/auth-cli.md) — auth CLI 명령 / 정책
- [docs/cli-json-output.md](./docs/cli-json-output.md) — `--json` stable contract + redaction 규약
- [docs/provider-notes.md](./docs/provider-notes.md) — provider별 observed endpoint / client_id
- [docs/telegram-bot.md](./docs/telegram-bot.md) — Telegram 봇 옵션 패키지 (`@token-weather/telegram`) 가이드
- [docs/typescript-consumers.md](./docs/typescript-consumers.md) — TypeScript 사용자용 d.ts / import 패턴

**기여자 / 운영자용** (contributor 한국 기반, 한글 only 유지):

- [docs/codebase-guide.md](./docs/codebase-guide.md) — 패키지 레이아웃 / shared 헬퍼 / 새 기능 체크리스트
- [docs/release-policy.md](./docs/release-policy.md) — semver / changeset / bump 기준
- [docs/auth-store-schema.md](./docs/auth-store-schema.md) — auth.json 저장 schema (기술 설계)
- [docs/claude-oauth-plan.md](./docs/claude-oauth-plan.md) — Claude OAuth 구현 과거 계획 (보관용)
