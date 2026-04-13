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

function formatWindow(window) {
  const reset = window.resetAt ? `reset_at=${window.resetAt}` : 'reset_at=unknown';
  const used = window.usedPercent ?? 'unknown';
  return `used_percent=${used}, ${reset}`;
}
