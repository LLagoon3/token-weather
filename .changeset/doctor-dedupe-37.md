---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
---

feat(cli): `doctor codex/claude --dedupe` / `--apply` / `--backfill-account-id` 옵션 추가 — 같은 OAuth subject (sub 또는 email) 의 stale 레코드를 dry-run 으로 감지하고 `--apply` 로 정리. login 시점 자동 정리(PR #38) 이전에 누적된 legacy accountKey 또는 id_token 파싱이 부분 실패한 레코드를 retroactive 로 청소 (issue #37). 자세한 사용법은 [docs/auth-cli.md §doctor `--dedupe`](docs/auth-cli.md).
