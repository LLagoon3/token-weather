/**
 * 봇이 노출하는 슬래시 명령의 단일 source.
 *
 * issue #148: Telegram `setMyCommands` Bot API (자동완성 메뉴) 와 `/help` 응답
 * 두 경로가 동일 배열을 참조해 정합성을 자동 보장한다.
 *
 * 각 항목 shape 은 Telegram Bot API `BotCommand` 와 동일:
 *   - `command`: 1–32자, `[a-z0-9_]`
 *   - `description`: 1–256자 UTF-8 (한글 OK)
 *
 * 새 명령을 dispatcher 에 추가할 때는 본 배열도 함께 갱신 — 매뉴 / `/help` /
 * dispatcher 세 곳이 동기화된다. dispatcher 의 키는 본 배열의 `command` 와 같은
 * 형식이어야 (`_` 포함 lowercase) 부합.
 */
export const BOT_COMMANDS = Object.freeze([
  Object.freeze({ command: 'status', description: '사용량 / 인증 상태' }),
  Object.freeze({ command: 'usage', description: 'status alias' }),
  Object.freeze({ command: 'doctor', description: '환경 / refresh 진단' }),
  Object.freeze({ command: 'auth_list', description: '저장된 계정 목록' }),
  Object.freeze({ command: 'help', description: '사용 가능한 명령 안내' }),
]);

/**
 * `/help` 응답용 plain text 빌더. Telegram `<pre>` 미사용 — 일반 메시지로 보내
 * 모바일이 자연스럽게 reflow 하도록 한다.
 *
 * 출력 모양 (BOT_COMMANDS 그대로):
 *
 *   Token Weather 봇 명령:
 *
 *   /status     — 사용량 / 인증 상태
 *   /usage      — status alias
 *   ...
 *
 * @param {ReadonlyArray<{command: string, description: string}>} [commands=BOT_COMMANDS]
 * @returns {string}
 */
export function formatHelpText(commands = BOT_COMMANDS) {
  if (!commands.length) {
    return 'Token Weather 봇 명령:\n\n(등록된 명령 없음)';
  }
  const maxCmdLen = commands.reduce((m, c) => Math.max(m, c.command.length), 0);
  const lines = ['Token Weather 봇 명령:', ''];
  for (const { command, description } of commands) {
    lines.push(`/${command.padEnd(maxCmdLen)}  — ${description}`);
  }
  return lines.join('\n');
}
