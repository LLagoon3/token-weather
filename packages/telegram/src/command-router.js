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
 * @param {string} text
 * @returns {ParsedCommand | null} 명령이 아니면 null.
 */
export function parseCommand(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const body = trimmed.slice(1);
  if (!body) return null;
  const [rawCmd, ...rest] = body.split(/\s+/);
  if (!rawCmd) return null;
  // /cmd@MyBot → cmd  (group chat 에서 다른 봇 멘션 분리 패턴).
  const cmd = rawCmd.split('@')[0].toLowerCase();
  if (!cmd) return null;
  return { cmd, args: rest };
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
