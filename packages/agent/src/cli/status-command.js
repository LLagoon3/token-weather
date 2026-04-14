import { getStatusSnapshot } from '../services/status-service.js';

export const STATUS_COMMANDS = ['status', 'usage'];

export async function runStatusCommand(command) {
  const snapshot = await getStatusSnapshot();

  console.log(`명령: ${command}`);
  console.log('로컬 에이전트 상태 요약');
  console.log('-----------------------');
  console.log(`설정 파일: ${snapshot.configPath}`);
  console.log(`Codex 사용: ${snapshot.providers.codex.enabled ? 'enabled' : 'disabled'}`);
  console.log(`Claude 사용: ${snapshot.providers.claude.enabled ? 'enabled' : 'disabled'}`);
  console.log(`서버 sync: ${snapshot.sync.enabled ? 'enabled' : 'disabled'}`);
  console.log('');
  printCodexSection(snapshot.codex);
  console.log('');
  printClaudeSection(snapshot.claude);
}

function printCodexSection(codex) {
  console.log('Codex usage');
  console.log('-----------');

  if (!codex.enabled) {
    console.log('비활성화됨');
    return;
  }

  console.log(`인증 소스: ${codex.authSource ?? 'unknown'}`);
  if (codex.authProfilesPath) {
    console.log(`Auth profiles 경로: ${codex.authProfilesPath}`);
  }

  if (codex.snapshots.length === 0) {
    console.log('발견된 Codex OAuth 프로필이 없습니다.');
    return;
  }

  for (const snapshot of codex.snapshots) {
    const label = snapshot.account.email ? `${snapshot.account.profileId} (${snapshot.account.email})` : snapshot.account.profileId;
    console.log(`- ${label}`);
    console.log(`  상태: ${snapshot.status.ok ? `OK (${snapshot.status.httpStatus})` : `실패 (${snapshot.status.httpStatus ?? 'network/error'})`}`);
    console.log(`  source=${snapshot.source}, authType=${snapshot.authType}, confidence=${snapshot.confidence}`);
    if (snapshot.account.plan) {
      console.log(`  플랜: ${snapshot.account.plan}`);
    }
    for (const window of snapshot.usageWindows) {
      console.log(`  ${window.kind}: ${formatWindow(window)}`);
    }
    if (snapshot.status.message) {
      console.log(`  에러: ${snapshot.status.message}`);
    }
  }
}

function printClaudeSection(claude) {
  console.log('Claude usage');
  console.log('------------');
  console.log(`인증 소스: ${claude.authSource}`);
  console.log(`credential 감지: ${claude.detected}`);
  if (claude.selectedAccount) {
    console.log(`계정: ${claude.selectedAccount.accountKey}`);
  }

  const usage = claude.usage;
  if (!usage || usage.source === 'not-found') {
    console.log('usage 데이터 없음 (stats-cache.json 미발견)');
    return;
  }

  console.log(`usage 소스: ${usage.source}`);
  console.log(`총 세션 수: ${usage.totalSessions ?? '알 수 없음'}`);
  console.log(`총 메시지 수: ${usage.totalMessages ?? '알 수 없음'}`);
  console.log(`모델별 usage: ${usage.hasModelUsage ? '있음' : '없음'}`);
  console.log(`일별 token 통계: ${usage.hasDailyModelTokens ? '있음' : '없음'}`);
}

function formatWindow(window) {
  const reset = window.resetAt ? `reset_at=${window.resetAt}` : 'reset_at=unknown';
  const used = window.usedPercent ?? 'unknown';
  return `used_percent=${used}, ${reset}`;
}
