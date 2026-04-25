/**
 * Spec-based CLI option parser.
 *
 * 각 커맨드의 파서는 defaults + flags 스펙만 선언하면 되도록 공통 루프를 분리한다.
 * 기존 parser(parseLoginOptions, parseStatusOptions 등)의 외부 계약을 보존하기 위해
 * - unknown flag: silent skip
 * - value-consuming flag에 값이 없으면: silent skip (warning 없음)
 * - 유효하지 않은 int/trim-empty string: 값은 default 유지, warnings 수집은 opt-in
 * 규약을 따른다.
 *
 * @typedef {object} FlagSpec
 * @property {string} key
 *   결과 객체에 값을 저장할 필드명.
 * @property {'boolean'|'string'|'int'} type
 * @property {boolean} [trim]
 *   type='string'일 때 값을 trim. 결과가 빈 문자열이면 skip (emptyMessage가 있으면 warning 수집).
 * @property {(n: number) => boolean} [validate]
 *   type='int'일 때 추가 유효성 검증. 실패 시 값은 default 유지.
 * @property {(n: number) => unknown} [transform]
 *   type='int'에서 유효 값을 변환 (e.g. seconds → ms).
 * @property {string} [invalidMessage]
 *   int 유효성 실패 시 warnings에 push할 메시지. `${value}` placeholder를 입력 문자열로 치환.
 * @property {string} [emptyMessage]
 *   trim=true에서 빈 문자열이 들어왔을 때 warning 메시지.
 *
 * @param {string[]|null|undefined} args
 * @param {{
 *   defaults: Record<string, unknown>,
 *   flags: Record<string, FlagSpec>,
 *   collectWarnings?: boolean,
 *   includeHelp?: boolean,
 * }} spec
 *   `includeHelp: true`이면 `--help` / `-h`를 자동으로 boolean 플래그로 인식해
 *   `options.help`에 저장한다 (defaults에 별도 선언 불필요).
 * @returns {Record<string, unknown>}
 */
export function parseCliOptions(args, spec) {
  const options = { ...spec.defaults };
  if (spec.collectWarnings) options.warnings = [];

  let flagMap = spec.flags;
  if (spec.includeHelp) {
    flagMap = {
      ...spec.flags,
      '--help': { key: 'help', type: 'boolean' },
      '-h': { key: 'help', type: 'boolean' },
    };
    if (!('help' in options)) options.help = false;
  }

  const list = args ?? [];
  for (let i = 0; i < list.length; i += 1) {
    const arg = list[i];
    const flagSpec = flagMap[arg];
    if (!flagSpec) continue;

    if (flagSpec.type === 'boolean') {
      options[flagSpec.key] = true;
      continue;
    }

    const value = list[i + 1];
    if (value === undefined) continue;

    // 레거시 파서(status/logout/doctor) 호환: `type:'string'` + `trim` 미지정이면
    // 빈 문자열("")은 "값 없음"으로 간주하여 assign/consume 모두 하지 않는다.
    // trim=true 쪽은 빈 값에도 emptyMessage warning을 push할 수 있으므로 consume한다.
    if (flagSpec.type === 'string' && !flagSpec.trim && value === '') continue;

    i += 1;

    if (flagSpec.type === 'string') {
      applyStringFlag(options, flagSpec, value, spec.collectWarnings);
    } else if (flagSpec.type === 'int') {
      applyIntFlag(options, flagSpec, value, spec.collectWarnings);
    }
  }

  return options;
}

function applyStringFlag(options, flagSpec, value, collectWarnings) {
  if (!flagSpec.trim) {
    options[flagSpec.key] = value;
    return;
  }
  const trimmed = String(value).trim();
  if (trimmed.length === 0) {
    if (collectWarnings && flagSpec.emptyMessage) {
      options.warnings.push(flagSpec.emptyMessage);
    }
    return;
  }
  options[flagSpec.key] = trimmed;
}

function applyIntFlag(options, flagSpec, value, collectWarnings) {
  const n = Number(value);
  const valid = Number.isInteger(n) && (flagSpec.validate ? flagSpec.validate(n) : true);
  if (!valid) {
    if (collectWarnings && flagSpec.invalidMessage) {
      options.warnings.push(flagSpec.invalidMessage.replace('${value}', String(value)));
    }
    return;
  }
  options[flagSpec.key] = flagSpec.transform ? flagSpec.transform(n) : n;
}
