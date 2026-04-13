import { prepareLocalhostCallback } from '../auth/localhost-callback.js';

export async function runAuthLoginCommand(provider, args = []) {
  if (!provider) {
    console.log('사용법: ai-usage-agent auth login <provider> [--manual] [--no-open] [--port <number>]');
    return;
  }

  if (provider !== 'codex') {
    console.log(`아직 login은 codex만 골격이 준비되어 있어. 입력된 provider: ${provider}`);
    return;
  }

  const options = parseLoginOptions(args);

  if (options.device) {
    console.log('device code flow는 후순위 항목이라 아직 구현되지 않았어.');
    return;
  }

  if (options.manual) {
    console.log('manual paste 흐름은 아직 골격 단계야. 다음 단계에서 구현될 예정이야.');
    return;
  }

  const prepared = await prepareLocalhostCallback({ preferredPort: options.port });

  console.log('ai-usage-agent auth login codex');
  console.log('--------------------------------');

  if (!prepared.ready) {
    console.log(prepared.reason);
    if (prepared.fallbackExhausted) {
      console.log('다음 단계에서 manual paste fallback으로 이어지도록 연결할 예정이야.');
    }
    return;
  }

  console.log(`콜백 URL 준비됨: ${prepared.params.callbackUrl}`);
  console.log(`선택된 포트: ${prepared.params.port}`);
  console.log('OAuth state/PKCE placeholder 생성 완료');
  console.log('주의: 실제 브라우저 로그인과 token exchange는 아직 구현되지 않았어.');
  if (options.noOpen) {
    console.log('--no-open 옵션이 지정되어 브라우저 자동 실행은 건너뜀');
  } else {
    console.log('다음 단계에서 브라우저 자동 실행을 연결할 예정이야.');
  }
}

function parseLoginOptions(args) {
  const options = {
    noOpen: false,
    manual: false,
    device: false,
    port: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--no-open') options.noOpen = true;
    if (arg === '--manual') options.manual = true;
    if (arg === '--device') options.device = true;
    if (arg === '--port') {
      const value = args[index + 1];
      if (value) {
        options.port = Number(value);
        index += 1;
      }
    }
  }

  return options;
}
