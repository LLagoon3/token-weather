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
  console.log('참고: 실제 provider usage fetch는 아직 연결 전입니다.');
}
