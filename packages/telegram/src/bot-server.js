/**
 * Telegram 봇 long-poll daemon 의 lifecycle factory.
 *
 * grammy `Bot` 인스턴스를 생성하고 token-weather 의 미들웨어 (auth allowlist) +
 * 라우팅 (command router → dispatcher) 를 연결한다. 실제 명령 핸들러 (status /
 * usage / doctor / auth-list) 는 Phase 3 (#128) 의 dispatcher 가 채운다.
 *
 * 본 모듈은 다음 책임만 진다:
 *   - grammy Bot 생성 + 미들웨어 체인 구성
 *   - message:text → parseCommand → dispatcher 라우팅
 *   - 단일-인스턴스 lock 보강 (409 Conflict 감지 시 친절한 종료)
 *   - SIGINT / SIGTERM 핸들러 등록 → graceful bot.stop()
 *
 * `@token-weather/cli` 의 `run-cli` 가 본 패키지를 dynamic import 한다는 점에서
 * 본 모듈은 절대 `@token-weather/cli` 를 import 해서는 안 된다 (순환 의존 회피
 * — PR #131 review 정책). 명령 핸들러가 필요로 하는 core 함수 (status snapshot /
 * formatters / config loader) 는 dispatcher 의 closure 가 통해서만 들어온다.
 */

import { Bot, GrammyError } from 'grammy';

import { authAllowlistMiddleware } from './auth-allowlist.js';
import { parseCommand, listAvailableCommands } from './command-router.js';
import { formatErrorForTelegram } from './formatters.js';

/**
 * @typedef {object} BotServerOptions
 * @property {string} botToken - BotFather 가 발급한 토큰.
 * @property {Array<number|string>} allowedUserIds - 명령 수신을 허용할 user_id.
 * @property {Record<string, (ctx: object, args: string[]) => Promise<void>>} [dispatcher]
 *   명령 이름 → 핸들러 mapping. Phase 3 (#128) 에서 채워짐. 비어 있으면 모든 명령에
 *   "구현 예정" placeholder 응답.
 * @property {{ log?: (msg: string) => void, error?: (msg: string) => void }} [logger]
 *   stdout/stderr 로그를 가로채기 위한 hook. 테스트에서 주입.
 * @property {(token: string) => object} [botFactory] - grammy `Bot` 생성을 가로채는
 *   훅. 기본은 `new Bot(token)` — 테스트에서 mock 주입 시점.
 */

/**
 * @typedef {object} BotServer
 * @property {() => Promise<void>} start - long-poll 시작 (fire-and-forget).
 * @property {() => Promise<void>} stop - graceful 종료.
 * @property {object} bot - 내부 grammy Bot 인스턴스 (테스트 / 확장 용).
 */

/**
 * grammy 기반 봇 서버를 구성해 반환한다. start() 를 호출해야 polling 시작.
 *
 * @param {BotServerOptions} options
 * @returns {BotServer}
 */
export function createBotServer(options) {
  const { botToken, allowedUserIds, dispatcher, logger, botFactory } = options ?? {};
  if (!botToken || typeof botToken !== 'string') {
    throw new Error('createBotServer: botToken (string) is required');
  }
  const log = logger?.log ?? ((msg) => console.log(msg));
  const errorLog = logger?.error ?? ((msg) => console.error(msg));

  const bot = botFactory ? botFactory(botToken) : new Bot(botToken);

  bot.use(authAllowlistMiddleware(allowedUserIds, { logger: { log } }));

  bot.on('message:text', async (ctx) => {
    // ctx.me.username — grammy 가 bot.init 후 자동 채움. group chat 에서
    // /cmd@OtherBot 같이 다른 봇 mention 은 parseCommand 가 null 반환 → silent.
    const parsed = parseCommand(ctx.message.text, {
      botUsername: ctx.me?.username,
    });
    if (!parsed) {
      await ctx.reply(
        `알 수 없는 입력입니다. 사용 가능한 명령: ${listAvailableCommands(dispatcher)}`,
      );
      return;
    }
    const handler = dispatcher?.[parsed.cmd];
    if (!handler) {
      await ctx.reply(`아직 구현되지 않은 명령입니다: /${parsed.cmd} (Phase 3 머지 후 활성화)`);
      return;
    }
    await handler(ctx, parsed.args);
  });

  bot.catch((errCtx) => {
    const err = errCtx.error;
    if (err instanceof GrammyError && err.error_code === 409) {
      errorLog(
        '[token-weather/telegram] 다른 daemon 이 이미 같은 봇 토큰으로 polling 중입니다 (Conflict 409). 종료합니다.',
      );
      process.exitCode = 1;
      void bot.stop();
      return;
    }
    errorLog(`[token-weather/telegram] 메시지 처리 중 오류: ${err?.message ?? String(err)}`);
    // 사용자에게는 stack 노출 없이 간결한 메시지만.
    void errCtx.ctx?.reply?.(formatErrorForTelegram(err), { parse_mode: 'HTML' }).catch(() => {});
  });

  let started = false;
  let shutdownHandlersRegistered = false;

  return {
    bot,
    async start() {
      if (started) {
        throw new Error('createBotServer.start: already started');
      }
      started = true;
      // Boot validation — grammy bot.init 이 getMe 호출로 token 유효성 검사.
      // 실패하면 lock 해제 + throw (PR #133 review 반영 — startBot 의 active
      // lock 잔존 방지). 정상 시 ctx.me.username 이 채워져 mention filter 동작.
      try {
        await bot.init();
      } catch (err) {
        started = false;
        throw err;
      }
      if (!shutdownHandlersRegistered) {
        registerShutdownHandlers(bot);
        shutdownHandlersRegistered = true;
      }
      // bot.start 는 polling 루프라 normal flow 에서 resolve 되지 않음 —
      // fire-and-forget. polling 단계 실패 (409 conflict 등) 는 .catch 로 받아
      // daemon 종료 처리 (lock 은 그대로 — process exit 으로 정리됨).
      bot
        .start({
          drop_pending_updates: false,
          onStart: (info) => {
            log(`[token-weather/telegram] @${info.username} polling 시작`);
          },
        })
        .catch((err) => {
          if (err instanceof GrammyError && err.error_code === 409) {
            errorLog(
              '[token-weather/telegram] 다른 daemon 이 이미 같은 봇 토큰으로 polling 중입니다 (Conflict 409). 종료합니다.',
            );
            process.exitCode = 1;
            return;
          }
          errorLog(`[token-weather/telegram] polling 시작 실패: ${err?.message ?? String(err)}`);
          process.exitCode = 1;
        });
    },
    async stop() {
      if (!started) return;
      await bot.stop();
      started = false;
    },
  };
}

/**
 * SIGINT / SIGTERM 발생 시 bot.stop() 을 호출해 long-poll 을 graceful 종료한다.
 * once 로 등록 — 동일 시그널 재진입은 OS 의 기본 핸들러로 fall through.
 *
 * @param {object} bot - grammy Bot 인스턴스.
 */
export function registerShutdownHandlers(bot) {
  const handler = () => {
    void bot.stop();
  };
  process.once('SIGINT', handler);
  process.once('SIGTERM', handler);
}
