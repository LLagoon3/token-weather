/**
 * Telegram update 의 `ctx.from.id` (Telegram user id) 를 allowlist 와 대조해
 * 미허용 발신자의 메시지를 silent 하게 거부하는 grammy 미들웨어.
 *
 * "silent" 인 이유: 미등록자가 봇에게 명령을 시도했을 때 응답하지 않음으로써
 * 봇의 존재 / 동작 여부를 외부에 minimal 노출한다. 봇 토큰이 누설된 시점의
 * 1차 방어막 역할. 로그에는 chat_id 부분 마스킹으로 흔적만 남긴다.
 *
 * Phase 4 (#129) 의 setup 명령이 일시적으로 빈 allowlist 로 daemon 을 띄울 때는
 * 본 미들웨어가 모든 메시지를 거부하지만, setup flow 자체가 `bot.use` 가
 * 등록되기 전 단계에서 `/pair <code>` 메시지를 직접 listen 하는 패턴을 쓸
 * 예정이라 (Phase 4 에서 상세) 충돌 없음.
 */

/**
 * @param {Array<number|string> | undefined | null} allowedChatIds
 * @param {{ logger?: { log?: (msg: string) => void } }} [options]
 * @returns {(ctx: object, next: () => Promise<void>) => Promise<void>}
 */
export function authAllowlistMiddleware(allowedChatIds, options) {
  const allowed = new Set((allowedChatIds ?? []).map((id) => String(id)));
  const log = options?.logger?.log ?? ((msg) => console.log(msg));
  return async (ctx, next) => {
    const fromId = ctx?.from?.id != null ? String(ctx.from.id) : null;
    if (!fromId || !allowed.has(fromId)) {
      if (fromId) {
        log(`[token-weather/telegram] 미허용 chat_id 거부: ${maskChatId(fromId)}`);
      }
      return;
    }
    await next();
  };
}

/**
 * chat_id 의 앞 3 자 / 뒤 2 자만 남기고 가운데를 마스킹. 4 자 이하 id 는 전체
 * 마스킹. 단일 사용자 환경에서도 로그 / 디버깅 시점에 raw id 가 그대로 평문에
 * 남지 않도록 보호.
 *
 * @param {string|number} id
 * @returns {string}
 */
export function maskChatId(id) {
  const s = String(id);
  if (s.length <= 4) return '****';
  return `${s.slice(0, 3)}****${s.slice(-2)}`;
}
