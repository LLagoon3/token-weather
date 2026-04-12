const fs = require('fs');

async function main() {
  const path = process.env.HOME + '/.openclaw/agents/main/agent/auth-profiles.json';
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
  const profiles = Object.entries(raw.profiles || {}).filter(([, v]) => v.provider === 'openai-codex' && v.type === 'oauth');

  for (const [id, profile] of profiles) {
    const headers = {
      Authorization: `Bearer ${profile.access}`,
      Accept: 'application/json',
      'User-Agent': 'CodexBar'
    };
    if (profile.accountId) headers['ChatGPT-Account-Id'] = profile.accountId;

    const res = await fetch('https://chatgpt.com/backend-api/wham/usage', { headers });
    const body = await res.json();
    console.log(JSON.stringify({
      profileId: id,
      status: res.status,
      primary: body?.rate_limit?.primary_window ?? null,
      secondary: body?.rate_limit?.secondary_window ?? null,
      plan: body?.plan_type ?? null,
      creditsBalance: body?.credits?.balance ?? null
    }, null, 2));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
