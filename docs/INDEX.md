# Token Weather Documentation Index

token-weather 의 모든 문서 entry point. 카테고리 / 사용자 타입 별로 분류.

문서 정책 (자세히): [CONTRIBUTING.md](../CONTRIBUTING.md). 한글이 source of truth, 외부 가시 docs 는 영문 번역 (`.en.md`) 도 같이 유지될 예정 (issue #154 roadmap).

## 시작점

- [README.md](../README.md) — 프로젝트 개요 + Install + 핵심 명령. 첫 진입 시 가장 먼저.
- 권한 / 토큰 누설 시 신고: [SECURITY.md](../SECURITY.md)
- 기여 / commit / PR 규칙: [CONTRIBUTING.md](../CONTRIBUTING.md)

## 외부 사용자용 — npm install 후 직접 참고

운영 / 자동화 / 통합 시 사용자가 직접 보는 문서.

| 문서                                                 | 한 줄 요약                                                                    | 영문                                                       |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [architecture.md](./architecture.md)                 | 패키지 / 모듈 구조의 고수준 요약                                              | [architecture.en.md](./architecture.en.md)                 |
| [auth-architecture.md](./auth-architecture.md)       | 인증 / token / source 우선순위 상세 (multi-account / refresh / fallback)      | [auth-architecture.en.md](./auth-architecture.en.md)       |
| [auth-cli.md](./auth-cli.md)                         | `auth login` / `auth list` / `auth logout` / `auth import` 명령 + 정책        | [auth-cli.en.md](./auth-cli.en.md)                         |
| [cli-json-output.md](./cli-json-output.md)           | `status --json` stable contract + redaction 규약 + SCHEMA_VERSION             | [cli-json-output.en.md](./cli-json-output.en.md)           |
| [provider-notes.md](./provider-notes.md)             | provider 별 observed endpoint / client_id / refresh 동작                      | [provider-notes.en.md](./provider-notes.en.md)             |
| [telegram-bot.md](./telegram-bot.md)                 | `@token-weather/telegram` 옵션 패키지 — 봇 setup / 핸들러 / OS service 가이드 | [telegram-bot.en.md](./telegram-bot.en.md)                 |
| [typescript-consumers.md](./typescript-consumers.md) | TypeScript 사용자용 d.ts / import 패턴 / 타입 안정성                          | [typescript-consumers.en.md](./typescript-consumers.en.md) |

## 기여자 / 운영자용 — contributor 한국 기반, 한글 only 유지

코드 패턴 / release 운영 / 내부 schema. 외부 사용자에게 가시도 낮은 문서.

| 문서                                           | 한 줄 요약                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| [codebase-guide.md](./codebase-guide.md)       | 패키지 레이아웃 / shared 헬퍼 / 새 기능 체크리스트 / anti-patterns |
| [release-policy.md](./release-policy.md)       | semver / changeset / bump 기준 / publish 흐름                      |
| [auth-store-schema.md](./auth-store-schema.md) | auth.json 저장 schema (기술 설계 — 구조 정의)                      |
| [claude-oauth-plan.md](./claude-oauth-plan.md) | Claude OAuth 구현 과거 계획 (보관용 — v0.5.0 이후 이력화)          |

## 메타 파일

| 파일                                               | 설명                                                        |
| -------------------------------------------------- | ----------------------------------------------------------- |
| [../README.md](../README.md)                       | 프로젝트 개요                                               |
| [../CONTRIBUTING.md](../CONTRIBUTING.md)           | 브랜치 / commit / PR / 작업 단위 / 라이선스                 |
| [../SECURITY.md](../SECURITY.md)                   | 보안 신고 채널 + Telegram 채널 위협 모델 + 토큰 revoke 절차 |
| [../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)     | Contributor Covenant 표준                                   |
| [../CHANGELOG.md](../CHANGELOG.md)                 | 사용자-가시 변경 history (Keep a Changelog)                 |
| [../.changeset/README.md](../.changeset/README.md) | changesets 도구 사용법                                      |

## 어디서 시작해야 할까

- **처음 사용**: [../README.md](../README.md) → `token-weather config init` → `token-weather auth login claude` → `token-weather status`
- **`--json` 출력으로 외부 dashboard 통합**: [cli-json-output.md](./cli-json-output.md)
- **Telegram 봇으로 원격 호출**: [telegram-bot.md](./telegram-bot.md)
- **TypeScript 프로젝트에서 import**: [typescript-consumers.md](./typescript-consumers.md)
- **기여 / PR 작성**: [../CONTRIBUTING.md](../CONTRIBUTING.md) → [codebase-guide.md](./codebase-guide.md)
- **release 운영 / publish 흐름**: [release-policy.md](./release-policy.md)
