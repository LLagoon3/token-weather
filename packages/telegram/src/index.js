/**
 * @token-weather/telegram — Telegram 봇 통합 패키지 진입점.
 *
 * 5-phase plan (issue #126~#130) 의 Phase 1 시점에서는 워크스페이스 scaffold +
 * placeholder export 만 제공한다. 실제 long-poll daemon / 명령 라우터 / 핸들러는
 * Phase 2~3 (#127, #128) 에서 채워지고, 사용자 setup 흐름은 Phase 4 (#129).
 */

/**
 * `@token-weather/cli` 의 `run-cli` 가 `telegram` 서브명령에서 dynamic import 로
 * 호출하는 진입점. Phase 3 머지 시점에 실제 dispatch 로직이 들어간다.
 *
 * @param {string[]} _argv - `token-weather telegram <subcommand> ...` 의 나머지 인자.
 * @returns {Promise<void>}
 */
export async function runTelegramCommand(_argv) {
  throw new Error(
    'token-weather telegram: 아직 구현되지 않았습니다 (5-phase plan 진행 중 — Phase 3 에서 활성화)',
  );
}
