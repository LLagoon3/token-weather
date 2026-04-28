# 보안 정책

이 도구는 OAuth access token / refresh token / id token 같은 자격증명을 로컬에서 다룹니다. 보안 이슈는 공개 이슈 트래커가 아닌 비공개 채널로 신고해 주세요.

## 지원 버전

| Version | Supported |
| ------- | --------- |
| `0.1.x` | ✅        |
| 그 이전 | ❌        |

## 비공개 신고 채널

GitHub Security Advisory를 통해 비공개로 신고해 주세요.

- 신고 페이지: https://github.com/LLagoon3/token-weather/security/advisories/new
- 평균 응답 SLA: 영업일 기준 5일 이내 1차 답변
- 심각도가 높은 경우(원격 토큰 유출, 자격증명 노출 등) 우선 대응

## 토큰을 실수로 공개 위치에 첨부했을 때

GitHub Issue / PR / 외부 채널(Slack, 이메일 본문 등)에 access token, refresh token, id token, session cookie, account key가 그대로 들어간 경우:

1. 즉시 해당 위치에서 토큰을 삭제(또는 issue/PR을 비공개로 전환)합니다.
2. 해당 자격증명을 즉시 **revoke** 합니다.
   - Codex (OpenAI): https://platform.openai.com/account/api-keys 또는 chatgpt.com 세션 로그아웃
   - Claude (Anthropic): https://console.anthropic.com 또는 Claude CLI 재로그인
3. `token-weather auth logout <provider>`로 로컬 store에서도 제거 후 재로그인합니다.

토큰 복구 / 자동 revoke 기능은 제공하지 않습니다 (provider revoke endpoint 미통합 상태).

## 새 토큰성 필드를 추가할 때 (메인테이너 / 기여자용)

`status --json` 출력은 토큰 키 blacklist 기반 redaction을 적용합니다 (`docs/cli-json-output.md` §한계 참고). 새 토큰 필드를 provider adapter / auth schema에 추가하는 PR에서는 다음을 함께 수행해야 합니다.

- `packages/agent/src/cli/status-json.js::SENSITIVE_KEYS`에 새 키 등록
- `--json` 출력 회귀 테스트(가짜 토큰 주입 → JSON에 누출 없음 검증) 추가

이 절차를 빠뜨리면 외부 소비자에게 그대로 노출될 수 있습니다.
