import { resolveAgentConfigPath } from '../config/config-path.js';

export async function runDoctorCommand() {
  console.log('ai-usage-agent doctor');
  console.log('---------------------');
  console.log(`예상 설정 파일 경로: ${resolveAgentConfigPath()}`);
  console.log('향후 점검 예정 항목:');
  console.log('- provider auth 존재 여부');
  console.log('- config 유효성');
  console.log('- endpoint 호출 가능 여부');
}
