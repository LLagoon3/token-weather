import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_CREDENTIALS_PATH = path.join(os.homedir(), '.claude', '.credentials.json');

export function resolveClaudeCredentialsPath(base = os.homedir()) {
  return path.join(base, '.claude', '.credentials.json');
}

export function parseClaudeCredentials(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const oauth = raw.claudeAiOauth;
  if (!oauth || typeof oauth !== 'object') {
    return null;
  }
  return oauth;
}

export function readClaudeCredentials(credentialsPath = DEFAULT_CREDENTIALS_PATH) {
  if (!fs.existsSync(credentialsPath)) {
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  return parseClaudeCredentials(raw);
}

export function getDefaultCredentialsPath() {
  return DEFAULT_CREDENTIALS_PATH;
}
