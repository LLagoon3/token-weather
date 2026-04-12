export async function fetchCodexUsage(profile, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;

  const headers = {
    Authorization: `Bearer ${profile.accessToken}`,
    Accept: 'application/json',
    'User-Agent': 'CodexBar'
  };

  if (profile.accountId) {
    headers['ChatGPT-Account-Id'] = profile.accountId;
  }

  const response = await fetchImpl('https://chatgpt.com/backend-api/wham/usage', {
    method: 'GET',
    headers
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  return {
    profileId: profile.id,
    email: profile.email,
    status: response.status,
    ok: response.ok,
    plan: data?.plan_type ?? null,
    creditsBalance: data?.credits?.balance ?? null,
    windows: {
      primary: normalizeWindow(data?.rate_limit?.primary_window),
      secondary: normalizeWindow(data?.rate_limit?.secondary_window)
    },
    rawError: response.ok ? null : text.slice(0, 500)
  };
}

function normalizeWindow(window) {
  if (!window) return null;

  return {
    usedPercent: window.used_percent ?? null,
    resetAt: window.reset_at ?? null,
    limitWindowSeconds: window.limit_window_seconds ?? null
  };
}
