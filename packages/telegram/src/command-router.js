/**
 * Telegram 메시지 텍스트 → 명령 / 인자 파싱.
 *
 * 책임 한계: 파싱과 dispatcher 메타 (available commands 표시) 만. 명령 실 dispatch
 * 는 bot-server.js 가 message:text 핸들러에서 dispatcher 객체를 lookup 하는 방식이고,
 * dispatcher 의 실 내용물 채우는 작업은 Phase 3 (#128).
 */

/**
 * @typedef {object} ParsedCommand
 * @property {string} cmd  - lowercase 명령 이름 (slash / mention 제거 후).
 * @property {string[]} args - 공백으로 split 된 추가 인자.
 */

/**
 * @typedef {object} ParseCommandOptions
 * @property {string} [botUsername] - 현재 봇의 Telegram username (`@` 제외).
 *   지정 시 `/cmd@OtherBot` 처럼 본인이 아닌 봇을 mention 한 명령은 null 로
 *   필터링 (group chat 에서 다른 봇과 공존 시 명령 충돌 방지). 미지정 시
 *   기존 동작 — mention suffix 만 strip.
 */

/**
 * @param {string} text
 * @param {ParseCommandOptions} [options]
 * @returns {ParsedCommand | null} 명령이 아니거나 본인이 아닌 봇 mention 이면 null.
 */
export function parseCommand(text, options) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const body = trimmed.slice(1);
  if (!body) return null;
  const [rawCmd, ...rest] = body.split(/\s+/);
  if (!rawCmd) return null;
  // /cmd@bot — `@` 가 있으면 mention 분리. botUsername 옵션이 주어진 경우
  // 본인이 아닌 mention 은 null 반환 (group chat 의 다른 봇 명령 차단).
  const atIdx = rawCmd.indexOf('@');
  let cmdPart = rawCmd;
  if (atIdx >= 0) {
    cmdPart = rawCmd.slice(0, atIdx);
    const mention = rawCmd.slice(atIdx + 1);
    const expected = options?.botUsername;
    if (expected != null && mention.toLowerCase() !== String(expected).toLowerCase()) {
      return null;
    }
  }
  const cmd = cmdPart.toLowerCase();
  if (!cmd) return null;
  return { cmd, args: rest };
}

/**
 * `text` 가 `/cmd@mention` 형식이면 mention 부분 (`@` 뒤 username) 을 반환.
 * 명령 형식이 아니거나 mention 이 없으면 null.
 *
 * bot-server 가 `parseCommand` 호출 *전* 에 mention 분기 (본인이 아닌 봇 mention
 * 은 silent ignore — group chat 충돌 방지) 에 사용 (PR #133 review).
 *
 * @param {string} text
 * @returns {string | null}
 */
export function extractMention(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const m = trimmed.match(/^\/\S+@(\S+)/);
  return m ? m[1] : null;
}

/**
 * dispatcher 객체의 키를 사람-읽기 친화 형태로 표시 — 미등록 명령 응답에 사용.
 * Phase 1/2 단계처럼 dispatcher 가 비어 있으면 안내 문구 반환.
 *
 * @param {Record<string, unknown> | undefined | null} dispatcher
 * @returns {string}
 */
export function listAvailableCommands(dispatcher) {
  const cmds = Object.keys(dispatcher ?? {}).sort();
  if (cmds.length === 0) {
    return '(등록된 명령 없음 — Phase 3 머지 후 활성화)';
  }
  return cmds.map((c) => `/${c}`).join(' ');
}
