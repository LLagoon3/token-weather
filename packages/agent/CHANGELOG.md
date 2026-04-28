# @token-weather/cli

## 0.2.0

### Minor Changes

- 7ec3111: `auth login` default 가 실제 OAuth 토큰 교환으로 변경되었습니다 (이전 default 는 mock 저장).

  Breaking changes:
  - `--live-exchange` flag 제거 → `--mock` flag 신설 (default = 실제 OAuth)
  - Codex / Claude 의 옵션 표면 + 라우팅 + default 동작 모두 일관성 정렬
    - `runCodexManualPasteFlow` 별도 함수 제거 → 공통 `runManualPasteFlow` 로 통합
    - 두 provider 모두 `supportsMockCallback: true` + `saveMockAccount` 보유
  - `@token-weather/provider-adapters` 의 `allowLiveExchange` 매개변수 + `liveExchangeDisabledError` 함수 + 관련 export 모두 제거
  - `auth list` 출력에서 `liveToken` 라인 제거 (mock 필드만 유지)

  자세한 흐름은 [docs/auth-cli.md](https://github.com/LLagoon3/token-weather/blob/main/docs/auth-cli.md) 참고.

### Patch Changes

- Updated dependencies [7ec3111]
  - @token-weather/provider-adapters@0.2.0
  - @token-weather/schemas@0.2.0
