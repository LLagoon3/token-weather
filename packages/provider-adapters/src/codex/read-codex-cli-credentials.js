import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_CREDENTIALS_PATH = path.join(os.homedir(), '.codex', 'auth.json');

/**
 * Codex CLI 가 OAuth 로그인 후 저장하는 자체 credential 파일 경로.
 *
 * 표준 위치: `~/.codex/auth.json`. claude 측의 `~/.claude/.credentials.json`
 * 와 대칭 (provider CLI 의 자체 OAuth 상태 파일).
 *
 * @param {string} [base] - HOME 디렉토리 base (테스트 편의)
 * @returns {string}
 */
export function resolveCodexCliCredentialsPath(base = os.homedir()) {
  return path.join(base, '.codex', 'auth.json');
}

/**
 * `~/.codex/auth.json` 의 raw 객체에서 OAuth tokens 객체를 추출한다.
 * Codex CLI 의 실제 schema:
 *   {
 *     "auth_mode": ...,
 *     "OPENAI_API_KEY": ...,
 *     "tokens": { id_token, access_token, refresh_token, account_id },
 *     "last_refresh": ...
 *   }
 *
 * `tokens` 객체가 없거나 access_token 이 없으면 null 반환.
 *
 * @param {unknown} raw
 * @returns {object|null}
 */
export function parseCodexCliCredentials(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tokens = raw.tokens;
  if (!tokens || typeof tokens !== 'object') return null;
  if (!tokens.access_token) return null;
  return tokens;
}

/**
 * Codex CLI 의 자체 credential 파일을 읽어 tokens 객체 반환. 파일이 없거나
 * JSON 파싱 실패, 또는 tokens 객체 부재 시 null.
 *
 * @param {string} [credentialsPath]
 * @returns {object|null}
 */
export function readCodexCliCredentials(credentialsPath = DEFAULT_CREDENTIALS_PATH) {
  if (!fs.existsSync(credentialsPath)) return null;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  } catch {
    return null;
  }
  return parseCodexCliCredentials(raw);
}

/**
 * default credential path. claude 측의 getDefaultCredentialsPath 와 대칭.
 *
 * @returns {string}
 */
export function getDefaultCodexCliCredentialsPath() {
  return DEFAULT_CREDENTIALS_PATH;
}
