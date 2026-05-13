export const DEFAULT_AGENT_CONFIG = {
  version: 1,
  output: {
    format: 'table',
    timezone: 'Asia/Seoul',
  },
  sync: {
    enabled: false,
    endpoint: '',
    apiKey: '',
  },
  providers: {
    codex: {
      enabled: true,
    },
    claude: {
      enabled: true,
    },
    /**
     * Telegram 봇 채널 — `@token-weather/telegram` 패키지가 daemon 으로 구동될
     * 때 본 키를 읽는다. 기본값은 opt-out (enabled: false). 활성화는
     * `token-weather telegram setup` 명령이 자동 갱신한다 (Phase 4).
     *
     *   - botToken: BotFather 가 발급한 토큰. SENSITIVE_KEYS 로 redact 됨.
     *   - allowedChatIds: 명령 수신을 허용할 Telegram user_id 배열 (단일
     *     사용자여도 array 형태 유지 — 추후 가족 / 멀티 디바이스 확장 여지).
     */
    telegram: {
      enabled: false,
      botToken: '',
      allowedChatIds: [],
    },
  },
  /**
   * 기본 프로필(계정) 선택 정책.
   *   - null 또는 미지정: 모든 real 계정 조회 (multi-account A)
   *   - 문자열: 해당 provider에 대해 accountKey / email / label 중 매치되는
   *     계정만 조회 (--account 와 동일한 우선순위)
   *   - CLI에서 --account로 넘긴 값이 있으면 설정값을 덮어쓴다.
   */
  defaults: {
    profiles: {
      codex: null,
      claude: null,
    },
  },
};

export function createDefaultConfig() {
  return structuredClone(DEFAULT_AGENT_CONFIG);
}
