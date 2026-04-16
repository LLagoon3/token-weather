export const DEFAULT_AGENT_CONFIG = {
  version: 1,
  output: {
    format: 'table',
    timezone: 'Asia/Seoul'
  },
  sync: {
    enabled: false,
    endpoint: '',
    apiKey: ''
  },
  providers: {
    codex: {
      enabled: true
    },
    claude: {
      enabled: true
    }
  }
};

export function createDefaultConfig() {
  return structuredClone(DEFAULT_AGENT_CONFIG);
}
