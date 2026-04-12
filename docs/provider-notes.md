# Provider Notes

## OpenAI Codex
- Endpoint: `https://chatgpt.com/backend-api/wham/usage`
- Auth: OAuth bearer token
- Optional header: `ChatGPT-Account-Id`
- Status: verified working in local environment

## Anthropic / Claude
- OAuth endpoint: `https://api.anthropic.com/api/oauth/usage`
- Web fallback:
  - `https://claude.ai/api/organizations`
  - `https://claude.ai/api/organizations/{orgId}/usage`
- Auth: OAuth token or claude.ai session key/cookie fallback
- Status: endpoint path confirmed, local auth not available yet for live verification
