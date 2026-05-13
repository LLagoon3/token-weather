/**
 * @token-weather/telegram — Telegram 봇 통합 패키지 진입점.
 *
 * 5-phase plan (issue #126~#130) 의 Phase 1 시점에서는 워크스페이스 scaffold +
 * placeholder export 만 제공한다. 실제 long-poll daemon / 명령 라우터 / 핸들러는
 * Phase 2~3 (#127, #128) 에서 채워지고, 사용자 setup 흐름은 Phase 4 (#129).
 *
 * ## 의존성 방향 (PR #131 review 지적 반영)
 *
 * `@token-weather/cli` 가 본 패키지를 dynamic import 로 호출하므로, 본 패키지가
 * 다시 `@token-weather/cli` 를 import 하면 순환이 생긴다. 반대로 core 로직 (status
 * snapshot / formatter / config loader) 을 본 패키지가 재구현하면 CLI 와 drift
 * 발생.
 *
 * 본 패키지는 그 두 경로 모두 피하기 위해 **의존성 주입 (deps injection)** 을
 * 채택한다 — `runTelegramCommand(argv, deps)` 의 `deps` 로 CLI 측이 core 함수
 * 묶음을 그대로 넘긴다. 본 패키지는 `@token-weather/provider-adapters` 와
 * `@token-weather/schemas` 만 직접 의존하고, status / usage / doctor / auth-list
 * 같은 CLI-소유 함수는 deps 를 통해서만 접근한다.
 *
 * Phase 3 (#128) 에서 `deps` 의 정확한 shape 가 typedef 로 굳어진다. 현재는
 * Phase 3 가 채울 핵심 키만 주석으로 가이드.
 */

/**
 * `@token-weather/cli` 의 `run-cli` 가 `telegram` 서브명령에서 dynamic import 로
 * 호출하는 진입점.
 *
 * @param {string[]} _argv - `token-weather telegram <subcommand> ...` 의 나머지 인자.
 * @param {object} [_deps] - CLI 가 주입하는 core 함수 묶음. Phase 3 에서 다음 키들이
 *   채워진다: `getStatusSnapshot`, `formatStatusOutput`, `formatStatusJson`,
 *   `collectDoctorReport`, `collectAuthListData`, `resolveAgentConfigPath`. 본 패키지가
 *   `@token-weather/cli` 를 직접 import 하지 않도록 막아 순환 의존을 방지한다.
 * @returns {Promise<void>}
 */
export async function runTelegramCommand(_argv, _deps) {
  throw new Error(
    'token-weather telegram: 아직 구현되지 않았습니다 (5-phase plan 진행 중 — Phase 3 에서 활성화)',
  );
}
