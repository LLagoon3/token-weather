import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_AUTH_PROFILES_PATH = path.join(
  os.homedir(),
  '.openclaw',
  'agents',
  'main',
  'agent',
  'auth-profiles.json',
);

export function readCodexAuthProfiles(authProfilesPath = DEFAULT_AUTH_PROFILES_PATH) {
  if (!fs.existsSync(authProfilesPath)) {
    return [];
  }

  const raw = JSON.parse(fs.readFileSync(authProfilesPath, 'utf8'));
  const profiles = Object.entries(raw.profiles || {})
    .filter(([, value]) => value?.provider === 'openai-codex' && value?.type === 'oauth')
    .map(([id, value]) => ({
      id,
      accessToken: value.access,
      accountId: value.accountId ?? null,
      email: value.email ?? null,
      expires: value.expires ?? null,
    }))
    .filter((profile) => Boolean(profile.accessToken));

  return profiles;
}

export function getDefaultAuthProfilesPath() {
  return DEFAULT_AUTH_PROFILES_PATH;
}
