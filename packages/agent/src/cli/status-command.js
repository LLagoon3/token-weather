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

  console.log(`Auth profiles 경로: ${codex.authProfilesPath}`);

  if (codex.profiles.length === 0) {
    console.log('발견된 Codex OAuth 프로필이 없습니다.');
    return;
  }

  for (const profile of codex.profiles) {
    const label = profile.email ? `${profile.profileId} (${profile.email})` : profile.profileId;
    console.log(`- ${label}`);
    console.log(`  상태: ${profile.ok ? `OK (${profile.status})` : `실패 (${profile.status ?? 'network/error'})`}`);
    if (profile.plan) {
      console.log(`  플랜: ${profile.plan}`);
    }
    if (profile.windows.primary) {
      console.log(`  primary: ${formatWindow(profile.windows.primary)}`);
    }
    if (profile.windows.secondary) {
      console.log(`  secondary: ${formatWindow(profile.windows.secondary)}`);
    }
    if (profile.rawError) {
      console.log(`  에러: ${profile.rawError}`);
    }
  }
}

function formatWindow(window) {
  const reset = window.resetAt ? `reset_at=${window.resetAt}` : 'reset_at=unknown';
  const used = window.usedPercent ?? 'unknown';
  return `used_percent=${used}, ${reset}`;
}
