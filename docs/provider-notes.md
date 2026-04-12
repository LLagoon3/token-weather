# Provider 메모

## OpenAI Codex
- Endpoint: `https://chatgpt.com/backend-api/wham/usage`
- 인증: OAuth bearer token
- 선택 헤더: `ChatGPT-Account-Id`
- 상태: 현재 로컬 환경에서 실작동 검증 완료

## Anthropic / Claude
- OAuth endpoint: `https://api.anthropic.com/api/oauth/usage`
- Web fallback:
  - `https://claude.ai/api/organizations`
  - `https://claude.ai/api/organizations/{orgId}/usage`
- 인증: OAuth token 또는 claude.ai session key/cookie fallback
- 상태: endpoint 경로는 확인했지만, 현재 로컬 인증이 없어 실호출 검증은 아직 미완료
