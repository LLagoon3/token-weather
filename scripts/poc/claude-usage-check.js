async function testClaudeOAuth(token) {
  const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'openclaw',
      Accept: 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'oauth-2025-04-20',
    },
  });
  console.log(res.status, await res.text());
}

async function testClaudeWeb(sessionKey) {
  const orgRes = await fetch('https://claude.ai/api/organizations', {
    headers: {
      Cookie: `sessionKey=${sessionKey}`,
      Accept: 'application/json',
    },
  });
  const orgs = await orgRes.json();
  const orgId = orgs?.[0]?.uuid;
  const usageRes = await fetch(`https://claude.ai/api/organizations/${orgId}/usage`, {
    headers: {
      Cookie: `sessionKey=${sessionKey}`,
      Accept: 'application/json',
    },
  });
  console.log(usageRes.status, await usageRes.text());
}

console.log('Provide a token/session key manually to use this PoC.');
