/**
 * `telegram setup` 서브명령 구현 — 대화형 페어링 + config 저장 + OS service
 * template print 흐름.
 *
 * Phase 4 (#129). 모든 외부 의존성 (prompt / fetch / Bot / fs) 은 옵션으로 주입
 * 가능 — 단위 테스트 친화. process.exitCode 만 부수효과로 두고 throw 는 자제
 * (사용자 친화 메시지 우선).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

import { validateBotToken, generatePairingCode, runPairingBot } from './pairing.js';
import { pickServiceTemplate } from './os-service-templates.js';
import { installOsService, parseYesNo } from './os-service-installer.js';

const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

/**
 * @typedef {object} SetupOptions
 * @property {(question: string) => Promise<string>} [promptFn]
 *   대화형 입력 함수. 미지정 시 node:readline 사용.
 * @property {typeof fetch} [fetchFn]
 *   getMe API 호출용. 미지정 시 global fetch.
 * @property {(token: string) => object} [botFactory]
 *   페어링 daemon 의 grammy Bot mock 주입 (테스트 용).
 * @property {(msg: string) => void} [log] - stdout hook.
 * @property {(msg: string) => void} [errorLog] - stderr hook.
 * @property {{ readFileSync: Function, writeFileSync: Function, mkdirSync: Function,
 *   chmodSync: Function, existsSync: Function }} [fsImpl] - fs API mock.
 */

/**
 * 두 객체를 재귀적으로 merge — `override` 가 `base` 보다 우선이지만, base 의
 * 키도 보존된다. PR #135 review — config 가 없을 때 `telegram setup` 이 default
 * config 의 providers / sync / defaults 같은 키를 누락하면 setup 직후 status /
 * usage 가 provider disabled 상태가 되는 문제 해소.
 */
function deepMerge(base, override) {
  if (typeof base !== 'object' || base === null) return override;
  if (typeof override !== 'object' || override === null) return override;
  if (Array.isArray(base) || Array.isArray(override)) return override;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    result[key] = key in base ? deepMerge(base[key], override[key]) : override[key];
  }
  return result;
}

/**
 * `token-weather telegram setup` 의 dispatch 진입점.
 *
 * @param {string[]} args
 * @param {{ resolveAgentConfigPath: () => string, cliScriptPath?: string }} deps
 * @param {SetupOptions} [options]
 * @returns {Promise<void>}
 */
export async function runSetupSubcommand(args, deps, options = {}) {
  const log = options.log ?? ((msg) => console.log(msg));
  const errorLog = options.errorLog ?? ((msg) => console.error(msg));
  if (Array.isArray(args) && (args.includes('--help') || args.includes('-h'))) {
    for (const line of formatTelegramSetupHelp()) log(line);
    return;
  }
  if (!deps?.resolveAgentConfigPath) {
    throw new Error('runSetupSubcommand: deps.resolveAgentConfigPath 가 필요합니다.');
  }

  const promptFn = options.promptFn ?? defaultPromptFn;
  const fetchFn = options.fetchFn ?? fetch;
  const fsImpl = options.fsImpl ?? fs;

  log('▶ token-weather telegram setup');
  log('');

  // 1) bot token 입력.
  const rawToken = await promptFn(
    'BotFather 에서 발급받은 봇 토큰을 입력하세요 (예: 1234567890:ABC...):\n> ',
  );
  const botToken = (rawToken ?? '').trim();
  if (!botToken) {
    errorLog('빈 토큰입니다. setup 을 취소합니다.');
    process.exitCode = 1;
    return;
  }

  // 2) 토큰 검증.
  log('');
  log('▶ Telegram Bot API getMe 호출로 토큰 검증...');
  const validation = await validateBotToken(botToken, { fetchFn });
  if (!validation.ok) {
    errorLog(`✗ 토큰 검증 실패: ${validation.error}`);
    process.exitCode = 1;
    return;
  }
  log(`✓ 봇 핸들: @${validation.botInfo.username}`);

  // 3) 1회용 코드 + 페어링 안내. deep link / 수동 명령 두 경로 모두 안내 (issue
  //    #137 — Telegram deep link 클릭 한 번으로 /start <code> 자동 전송 가능).
  const code = generatePairingCode();
  // deep link URL — code 를 encodeURIComponent 로 감싸 방어 (PR #139 review).
  // 현재 generatePairingCode 가 URL-safe (`TGW-XXXXXX`) 라 사실상 영향 없지만,
  // code 형식이 후속에 바뀌어도 안전. Telegram username 규칙은 URL path 안전이라
  // 별도 encoding 불필요.
  const deepLink = `https://t.me/${validation.botInfo.username}?start=${encodeURIComponent(code)}`;
  log('');
  log('▶ 다음 중 하나로 페어링하세요:');
  log('');
  log('  (A) 아래 링크를 클릭하면 Telegram 앱이 봇 대화창으로 열립니다:');
  log(`      ${deepLink}`);
  log('      봇을 처음 여는 경우 "Start" 버튼이 보이면 한 번 누르세요 (페어링 코드는 자동 전달).');
  log('');
  log(`  (B) Telegram 앱에서 @${validation.botInfo.username} 봇에게 다음 명령을 직접 입력:`);
  log(`      /pair ${code}`);
  log('');
  log('   (5 분 안에 진행하지 않으면 setup 이 취소됩니다.)');

  // 4) 페어링 daemon 부팅 + chat_id 캡처.
  let pairingResult;
  try {
    pairingResult = await runPairingBot(botToken, code, {
      botFactory: options.botFactory,
      logger: { log },
    });
  } catch (err) {
    errorLog(`✗ 페어링 실패: ${err?.message ?? err}`);
    process.exitCode = 1;
    return;
  }
  log('');
  log(
    `✓ 페어링 완료 — user_id: ${pairingResult.userId}${
      pairingResult.username ? ` (@${pairingResult.username})` : ''
    }`,
  );

  // 5) config read + default merge + 갱신 + write + chmod 600.
  //    PR #135 review — config 가 없을 때 partial 만 생성하면 setup 직후 status /
  //    usage 가 provider disabled 상태가 되는 문제. deps.createDefaultConfig 로
  //    base 를 만들고 기존 config 를 deepMerge 한 뒤 channels.telegram 만 override.
  const configPath = deps.resolveAgentConfigPath();
  const base = typeof deps.createDefaultConfig === 'function' ? deps.createDefaultConfig() : {};
  let existing = {};
  if (fsImpl.existsSync(configPath)) {
    try {
      existing = JSON.parse(fsImpl.readFileSync(configPath, 'utf8'));
    } catch (err) {
      errorLog(`✗ 설정 파일 파싱 실패: ${configPath}`);
      errorLog(`  ${err?.message ?? err}`);
      process.exitCode = 1;
      return;
    }
  }
  const config = deepMerge(base, existing);
  // user_id 는 array number 또는 string — Number 변환 시도, 실패 시 원본 유지.
  const numericId = Number(pairingResult.userId);
  const storedId = Number.isFinite(numericId) ? numericId : pairingResult.userId;
  config.channels = config.channels ?? {};
  config.channels.telegram = {
    ...(config.channels.telegram ?? {}),
    enabled: true,
    botToken,
    allowedUserIds: [storedId],
  };
  fsImpl.mkdirSync(path.dirname(configPath), { recursive: true });
  fsImpl.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  let chmodApplied = true;
  try {
    fsImpl.chmodSync(configPath, 0o600);
  } catch (err) {
    chmodApplied = false;
    errorLog(`⚠ chmod 600 적용 실패 (계속 진행): ${err?.message ?? err}`);
  }
  log('');
  log(
    `✓ 설정 저장: ${configPath}${
      chmodApplied ? ' (chmod 600)' : ' (chmod 미적용 — `telegram check` 로 권한 확인 필요)'
    }`,
  );

  // 6) OS service 자동 등록 동의 프롬프트 (issue #138) — Y default. 거부 / skip /
  //    실패 시 수동 등록 안내 fallback.
  const installerInput = {
    nodeBinPath: process.execPath,
    cliScriptPath: deps.cliScriptPath ?? process.argv[1] ?? '',
    homeDir: process.env.HOME,
  };
  const tmpl = pickServiceTemplate(installerInput);
  const installer = options.installer ?? installOsService;

  log('');
  log(DIVIDER);
  log(`부팅 후 자동 시작 (선택사항) — ${tmpl.title}`);
  log('');
  const consentRaw = await promptFn('자동으로 설치하시겠습니까? [Y/n] ');
  const consent = parseYesNo(consentRaw, true);
  log('');

  if (consent) {
    // promptFn 기반 confirm adapter (PR #140 review blocker 1) — installer 가
    // 기존 service 파일 충돌 같은 사용자 결정이 필요한 시점에 실제 프롬프트를
    // 띄우도록. options.confirmFn 미주입 시 default 가 prompt 없이 boolean 만
    // 반환하는 문제 해소.
    const confirmFn =
      options.confirmFn ??
      (async (question, defaultYes) => {
        const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
        const answer = await promptFn(`${question}${suffix}`);
        return parseYesNo(answer, Boolean(defaultYes));
      });

    const result = await installer(installerInput, {
      fsImpl,
      execImpl: options.execImpl,
      confirmFn,
      log,
      errorLog,
      env: options.env ?? process.env,
      platform: options.platform,
    });
    if (result.status === 'succeeded') {
      log(`✓ ${result.message}`);
      for (const step of result.steps ?? []) log(`  · ${step}`);
    } else if (result.status === 'skipped') {
      log(`ℹ ${result.message}`);
      log('');
      log('수동 등록 안내:');
      for (const line of tmpl.instructions) log(`  ${line}`);
    } else {
      errorLog(`✗ 자동 설치 실패: ${result.error ?? result.message}`);
      log('');
      log('수동 등록 안내:');
      for (const line of tmpl.instructions) log(`  ${line}`);
    }
  } else {
    log('자동 설치 건너뜀 — 수동 등록 안내:');
    for (const line of tmpl.instructions) log(`  ${line}`);
  }
  log('');
  log(DIVIDER);
  log('');
  log('지금 한 번만 실행하려면: `token-weather telegram start`');
}

/**
 * Default prompt — node:readline 사용. process.stdin / stdout 직접.
 */
function defaultPromptFn(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * `token-weather telegram setup --help` 출력. Pure function.
 */
export function formatTelegramSetupHelp() {
  return [
    'token-weather telegram setup',
    '',
    '대화형으로 봇 토큰 등록 + 페어링 + 설정 저장 + OS service template 안내.',
    '',
    'Options:',
    '  -h, --help   이 도움말 출력',
    '',
    '흐름:',
    '  1. BotFather 발급 토큰 입력',
    '  2. getMe API 로 토큰 검증',
    '  3. 1회용 코드 생성 → Telegram 봇에 `/pair <code>` 입력',
    '  4. user_id 수신 → config 갱신 (~/.config/token-weather/config.json, chmod 600)',
    '  5. OS 별 service template 출력 (복사 / 붙여넣기로 부팅 자동 시작 설정)',
  ];
}
