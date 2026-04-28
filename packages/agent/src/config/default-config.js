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
