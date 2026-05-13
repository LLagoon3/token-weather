/**
 * Telegram setup 의 페어링 helpers — bot token 검증 + 1회용 페어링 daemon.
 *
 * Phase 4 (#129). createBotServer 와 별도 — 페어링은 allowlist 없이 raw `/pair
 * <code>` 메시지를 받아 chat_id 를 캡처해야 하므로 (사용자가 allowlist 등록을
 * 받지 않은 첫 메시지), 별도 1회용 daemon 패턴.
 *
 * 모든 외부 의존성 (fetch / Bot) 은 옵션으로 주입 가능 — 단위 테스트 친화.
 */

import { Bot } from 'grammy';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_PAIRING_TIMEOUT_MS = 300_000; // 5 분.

/**
 * Telegram Bot API `getMe` 로 bot token 유효성 검증.
 *
 * @param {string} botToken
 * @param {{
 *   fetchFn?: typeof fetch,
 *   apiBase?: string,
 * }} [options]
 * @returns {Promise<{ ok: true, botInfo: object } | { ok: false, error: string }>}
 */
export async function validateBotToken(botToken, options = {}) {
  if (!botToken || typeof botToken !== 'string') {
    return { ok: false, error: 'bot token is empty' };
  }
  const fetchFn = options.fetchFn ?? fetch;
  const apiBase = options.apiBase ?? TELEGRAM_API_BASE;
  try {
    const res = await fetchFn(`${apiBase}/bot${botToken}/getMe`);
    const body = await res.json();
    if (!body || body.ok !== true) {
      return { ok: false, error: body?.description ?? `HTTP ${res.status}` };
    }
    return { ok: true, botInfo: body.result };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}

/**
 * 1회용 페어링 코드 생성 — `TGW-XXXXXX` (대소문자 가독성 문자만).
 *
 * @returns {string}
 */
export function generatePairingCode() {
  // 0/1/I/O 제외 — OCR / 시각적 혼동 회피.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `TGW-${suffix}`;
}

/**
 * 페어링용 1회 daemon 을 띄워 `/pair <code>` 메시지의 `ctx.from.id` 를 캡처.
 *
 * - 일치하는 code 가 도착하면 resolve.
 * - 일치하지 않는 code 는 ctx.reply 로 안내 후 대기 지속.
 * - timeoutMs 안에 도착 안 하면 reject.
 *
 * @param {string} botToken
 * @param {string} expectedCode
 * @param {{
 *   timeoutMs?: number,
 *   botFactory?: (token: string) => object,
 *   logger?: { log?: (msg: string) => void },
 * }} [options]
 * @returns {Promise<{ userId: string, username: string | null }>}
 */
export async function runPairingBot(botToken, expectedCode, options = {}) {
  if (!botToken) throw new Error('runPairingBot: botToken is required');
  if (!expectedCode) throw new Error('runPairingBot: expectedCode is required');
  const timeoutMs = options.timeoutMs ?? DEFAULT_PAIRING_TIMEOUT_MS;
  const bot = options.botFactory ? options.botFactory(botToken) : new Bot(botToken);
  const log = options.logger?.log ?? ((msg) => console.log(msg));

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      void bot.stop?.();
      reject(
        new Error(
          `pairing timeout (${Math.floor(timeoutMs / 1000)}s) — /pair 명령이 도착하지 않았습니다.`,
        ),
      );
    }, timeoutMs);
    if (typeof timer?.unref === 'function') timer.unref();

    bot.on?.('message:text', async (ctx) => {
      if (settled) return;
      const text = ctx?.message?.text?.trim?.() ?? '';
      const match = text.match(/^\/pair\s+(\S+)/);
      if (!match) return;
      const submittedCode = match[1];
      if (submittedCode !== expectedCode) {
        await ctx?.reply?.('코드가 일치하지 않습니다. 다시 확인해 주세요.').catch(() => {});
        return;
      }
      const userId = ctx?.from?.id;
      if (userId == null) {
        await ctx?.reply?.('user_id 를 인식할 수 없습니다.').catch(() => {});
        return;
      }
      settled = true;
      clearTimeout(timer);
      await ctx?.reply?.('✓ 페어링 완료. 터미널을 확인하세요.').catch(() => {});
      void bot.stop?.();
      resolve({
        userId: String(userId),
        username: ctx?.from?.username ?? null,
      });
    });

    bot.catch?.((errCtx) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(errCtx?.error ?? errCtx);
    });

    Promise.resolve(bot.init?.())
      .then(() => {
        log(
          `[token-weather/telegram] 페어링 daemon 시작 — 봇에 \`/pair ${expectedCode}\` 입력 대기 중...`,
        );
        bot.start?.({ drop_pending_updates: true })?.catch?.((err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        });
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
  });
}
