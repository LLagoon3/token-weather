---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
---

refactor(adapters)!: claude `~/.claude/stats-cache.json` 의존 제거 — `status --json` 의 `claude.usage` 필드 + per-session/per-message 누적 통계 출력 + public export (`readClaudeStatsCache`, `parseClaudeStatsCache`, `resolveClaudeUsageSource`, `resolveClaudeUsageSourcePath`) 제거. 본 도구는 이제 network endpoint (`/api/oauth/usage`) 의 window 기반 사용률 정보 (five_hour / seven_day) 만 노출한다 — Codex 의 server-side rate-limit 모델과 architectural symmetry. v0.x convention 상 breaking 도 minor 로 bump (release-policy §1 의 major 트리거지만 v0.x).

**Migration**: `status --json` 결과에서 `.providers[].snapshot.usage` 또는 `.providers[].snapshot.usage.source === 'stats-cache-json'` 분기를 사용하던 consumer 는 필드 부재로 갱신 필요. window 정보는 `.providers[].snapshot.networkUsage.usageWindows` 에서 그대로 받을 수 있다. 누적 통계가 필요하면 `~/.claude/stats-cache.json` 을 직접 파싱 — Anthropic 의 client-side artifact 라 본 도구가 추상화하지 않는다.

(issue #110)
