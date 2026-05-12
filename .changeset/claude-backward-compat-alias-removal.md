---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
---

chore(agent)!: `status --json` 의 claude provider 영역에서 backward-compat alias 3 종 제거 (issue #119). `SCHEMA_VERSION` `'0.3.0'` → `'0.4.0'`. v0.x convention 상 breaking 도 minor + `!` prefix (release-policy §1 / §3).

**Breaking changes**:

- `.providers[].snapshot.networkUsage` (단일 객체) 제거 — `.providers[].snapshot.networkUsages[]` (배열) 만 유지.
- `.providers[].snapshot.importedAccount` 제거 — `.providers[].snapshot.selectedAccount` 만 유지 (동일 값이었음).
- `.providers[].snapshot.parsed` 제거 — `.providers[].snapshot.found` 만 유지 (항상 같은 값이었음).
- `formatClaudeSection` (status-formatters / doctor-helpers) 의 legacy `networkUsage` (단일) fallback 코드 경로 제거 — 항상 `networkUsages[]` 배열만 처리.

**Migration**:

- `.providers[].snapshot.networkUsage` 참조 → `.providers[].snapshot.networkUsages[0].snapshot` (단일 계정) 또는 array 순회. **주의** — 이전 `networkUsage` 는 usage snapshot 객체 그대로였지만, 신규 `networkUsages[]` 의 각 원소는 `{ accountKey, account, snapshot }` wrapper. 실제 `usageWindows` / `status` 등 데이터는 `.snapshot` 안에 있어 `.snapshot` 단계 추가 필요. 자세한 예시는 `docs/cli-json-output.md` §"제거된 backward-compat alias (v0.4.0)".
- `.providers[].snapshot.importedAccount` 참조 → `.providers[].snapshot.selectedAccount` 동일 의미.
- `.providers[].snapshot.parsed` 참조 → `.providers[].snapshot.found` 동일 의미.

`status --json` 외 평문 출력 / public API surface / runtime deps 무변경. 회귀 가드 — alias 키 부재 단언 신규 추가 (status-json.test.js / claude-provider.test.js / status-service.test.js).
