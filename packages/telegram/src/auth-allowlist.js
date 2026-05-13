/**
 * Telegram update 의 `ctx.from.id` (Telegram user_id) 를 allowlist 와 대조해
 * 미허용 발신자의 메시지를 silent 하게 거부하는 grammy 미들웨어.
 *
 * "허용된 사용자" 보안 모델 — `chat.id` 가 아니라 `from.id` 를 검사한다.
 * DM 에서는 둘이 같지만, group / supergroup 에서는 다르며 본 모듈은 "이
 * 사용자가 보낸 명령인가" 를 기준으로 한다. 단일 사용자가 자기 user_id 를
 * allowlist 에 등록하면 어떤 채팅방에서도 동일하게 명령 가능.
 *
 * "silent" 인 이유: 미등록자가 봇에게 명령을 시도했을 때 응답하지 않음으로써
 * 봇의 존재 / 동작 여부를 외부에 minimal 노출한다. 봇 토큰이 누설된 시점의
 * 1차 방어막. 로그에는 user_id 부분 마스킹으로 흔적만 남긴다.
 *
 * Phase 4 (#129) 의 setup 명령이 일시적으로 빈 allowlist 로 daemon 을 띄울 때는
 * 본 미들웨어가 모든 메시지를 거부하지만, setup flow 자체가 `bot.use` 가
 * 등록되기 전 단계에서 `/pair <code>` 메시지를 직접 listen 하는 패턴을 쓸
 * 예정이라 (Phase 4 에서 상세) 충돌 없음.
 */

/**
 * @param {Array<number|string> | undefined | null} allowedUserIds
 * @param {{ logger?: { log?: (msg: string) => void } }} [options]
 * @returns {(ctx: object, next: () => Promise<void>) => Promise<void>}
 */
export function authAllowlistMiddleware(allowedUserIds, options) {
  const allowed = new Set((allowedUserIds ?? []).map((id) => String(id)));
  const log = options?.logger?.log ?? ((msg) => console.log(msg));
  return async (ctx, next) => {
    const fromId = ctx?.from?.id != null ? String(ctx.from.id) : null;
    if (!fromId || !allowed.has(fromId)) {
      if (fromId) {
        log(`[token-weather/telegram] 미허용 user_id 거부: ${maskUserId(fromId)}`);
      }
      return;
    }
    await next();
  };
}

/**
 * Telegram user_id 의 앞 3 자 / 뒤 2 자만 남기고 가운데를 마스킹. 4 자 이하 id 는
 * 전체 마스킹. 단일 사용자 환경에서도 로그 / 디버깅 시점에 raw id 가 그대로
 * 평문에 남지 않도록 보호.
 *
 * @param {string|number} id
 * @returns {string}
 */
export function maskUserId(id) {
  const s = String(id);
  if (s.length <= 4) return '****';
  return `${s.slice(0, 3)}****${s.slice(-2)}`;
}
