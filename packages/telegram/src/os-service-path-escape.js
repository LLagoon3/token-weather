/**
 * OS service installer 의 경로 escape helper — systemd unit / launchd plist /
 * Windows schtasks 각자의 quoting 규칙에 맞춰 자동 등록 가능한 형태로 변환.
 *
 * issue #141: PR #140 review 2 round 의 follow-up. 기존에는 `hasUnsafePathChars`
 * 사전 검사로 공백 / 특수문자 포함 경로를 자동 skip + manual fallback 했는데,
 * **Windows 표준 Node 설치 환경** (`C:\Program Files\nodejs\node.exe`) 에서는
 * 자동 등록이 거의 항상 차단되어 [Y/n] 옵션이 무의미했음. 본 모듈의 helper 3개로
 * 모든 정상 경로를 안전하게 quoting → 자동 등록 success rate 확장.
 *
 * 각 OS 의 quoting spec:
 *   - systemd: `man systemd.syntax` (Quoting / Escaping)
 *   - launchd plist: XML 1.0 entity escape (`&` `<` `>` 만, attribute 아닌 text content)
 *   - Windows schtasks /TR: cmd.exe escape (path 의 `"` 만 위험, 실제 Windows 파일명에 `"` 는 못 들어가 안전성 거의 OK 지만 일관성 유지)
 *
 * 본 모듈은 외부 dependency 0 — 순수 string 변환만.
 */

/**
 * systemd unit `ExecStart=` / `Exec*=` directive 안에 들어갈 인자를 quoting.
 *
 * systemd 는 standard shell 이 아니라 직접 exec → `$VAR` / `` `cmd` `` 같은
 * expansion 없음. 그래서 double-quote 안에서 escape 필요한 문자는 `"` 와 `\`
 * 두 개뿐.
 *
 * @param {string} value - escape 대상 (path / argument).
 * @returns {string} double-quote 로 감싸진 escape 형태. 빈 입력 → `""`.
 *
 * @example
 *   escapeSystemdArg('/usr/bin/node')                // → '"/usr/bin/node"'
 *   escapeSystemdArg('C:\\Program Files\\node.exe')  // → '"C:\\\\Program Files\\\\node.exe"'
 *   escapeSystemdArg('path with "quote"')            // → '"path with \\"quote\\""'
 */
export function escapeSystemdArg(value) {
  if (value == null || value === '') return '""';
  const text = String(value);
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * launchd plist `<string>...</string>` text content 의 XML entity escape.
 *
 * Attribute 가 아닌 element content 라 `'` `"` escape 불필요 — `&` `<` `>` 만.
 * `&` 를 가장 먼저 처리해야 후속 entity 가 다시 escape 되지 않음.
 *
 * @param {string} text - escape 대상 (path 또는 다른 element content).
 * @returns {string} XML-safe 문자열. null/undefined → 빈 문자열.
 *
 * @example
 *   escapePlistXml('/usr/local/bin/node')   // → '/usr/local/bin/node'
 *   escapePlistXml('path/with & ampersand') // → 'path/with &amp; ampersand'
 *   escapePlistXml('<weird>')               // → '&lt;weird&gt;'
 */
export function escapePlistXml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Windows `schtasks /TR` 의 인자 quoting.
 *
 * `/TR` 는 single string 으로 program + args 받음 → 각 인자를 `"..."` 로 감싸고
 * 인자 사이는 space. path 안 `"` 는 `\\"` 로 escape (Windows 파일명에 `"` 는
 * 못 들어가지만 일관성 / defensive 차원).
 *
 * @param {string} value - escape 대상 (path / argument).
 * @returns {string} double-quote 로 감싸진 escape 형태. 빈 입력 → `""`.
 *
 * @example
 *   escapeSchtasksArg('C:\\Program Files\\node.exe')
 *   // → '"C:\\Program Files\\node.exe"'
 */
export function escapeSchtasksArg(value) {
  if (value == null || value === '') return '""';
  const text = String(value);
  return `"${text.replace(/"/g, '\\"')}"`;
}
