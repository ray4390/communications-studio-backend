import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS provider_accounts (
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_user_id),
  UNIQUE (provider, user_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  session_user_id TEXT,
  return_to TEXT NOT NULL,
  code_verifier TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_states_expiry_idx ON oauth_states(expires_at);
`);

const now = () => Date.now();
export const hashToken = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const newId = () => crypto.randomUUID();

export function cleanupExpired() {
  const t = now();
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(t);
  db.prepare('DELETE FROM oauth_states WHERE expires_at <= ?').run(t);
}

export function createAppSession(userId) {
  cleanupExpired();
  const raw = randomToken(32);
  const t = now();
  const expires = t + config.sessionTtlDays * 86400_000;
  db.prepare('INSERT INTO sessions (token_hash,user_id,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?)')
    .run(hashToken(raw), userId, t, t, expires);
  return { token: raw, expiresAt: expires };
}

export function readAppSession(rawToken) {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const row = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash);
  if (!row) return null;
  if (row.expires_at <= now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(now(), tokenHash);
  return row;
}

export function revokeAppSession(rawToken) {
  if (rawToken) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(rawToken));
}

export function createOauthState({ provider, sessionUserId = null, returnTo, codeVerifier = null }) {
  cleanupExpired();
  const raw = randomToken(32);
  const t = now();
  db.prepare('INSERT INTO oauth_states (state_hash,provider,session_user_id,return_to,code_verifier,created_at,expires_at) VALUES (?,?,?,?,?,?,?)')
    .run(hashToken(raw), provider, sessionUserId, returnTo, codeVerifier, t, t + config.oauthTtlMinutes * 60_000);
  return raw;
}

export function consumeOauthState(rawState, provider) {
  if (!rawState) return null;
  const stateHash = hashToken(rawState);
  const row = db.prepare('SELECT * FROM oauth_states WHERE state_hash = ? AND provider = ?').get(stateHash, provider);
  db.prepare('DELETE FROM oauth_states WHERE state_hash = ?').run(stateHash);
  if (!row || row.expires_at <= now()) return null;
  return row;
}

function parseJson(value) {
  try { return JSON.parse(value || '{}'); } catch { return {}; }
}

export function accountForUser(userId, provider) {
  const row = db.prepare('SELECT * FROM provider_accounts WHERE user_id = ? AND provider = ?').get(userId, provider);
  return row ? { ...row, metadata: parseJson(row.metadata_json) } : null;
}

export function accountsForUser(userId) {
  return db.prepare('SELECT * FROM provider_accounts WHERE user_id = ?').all(userId)
    .map((row) => ({ ...row, metadata: parseJson(row.metadata_json) }));
}

export function updateAccountMetadata(userId, provider, metadata) {
  db.prepare('UPDATE provider_accounts SET metadata_json = ?, updated_at = ? WHERE user_id = ? AND provider = ?')
    .run(JSON.stringify(metadata || {}), now(), userId, provider);
}

export function linkProviderAccount({ provider, providerUserId, currentUserId = null, username = '', displayName = '', avatarUrl = '', metadata = {} }) {
  const existing = db.prepare('SELECT * FROM provider_accounts WHERE provider = ? AND provider_user_id = ?').get(provider, String(providerUserId));
  const existingOnCurrent = currentUserId
    ? db.prepare('SELECT * FROM provider_accounts WHERE provider = ? AND user_id = ?').get(provider, currentUserId)
    : null;

  if (currentUserId && existing && existing.user_id !== currentUserId) {
    throw Object.assign(new Error(`This ${provider} account is already linked to another Communications Studio user.`), { code: 'ACCOUNT_ALREADY_LINKED' });
  }
  if (currentUserId && existingOnCurrent && existingOnCurrent.provider_user_id !== String(providerUserId)) {
    throw Object.assign(new Error(`This Communications Studio user already has a different ${provider} account linked.`), { code: 'PROVIDER_ALREADY_LINKED' });
  }

  let userId = currentUserId || existing?.user_id;
  const t = now();
  if (!userId) {
    userId = newId();
    db.prepare('INSERT INTO users (id,created_at,updated_at) VALUES (?,?,?)').run(userId, t, t);
  }
  db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(t, userId);
  db.prepare(`
    INSERT INTO provider_accounts (provider,provider_user_id,user_id,username,display_name,avatar_url,metadata_json,updated_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(provider,provider_user_id) DO UPDATE SET
      user_id=excluded.user_id, username=excluded.username, display_name=excluded.display_name,
      avatar_url=excluded.avatar_url, metadata_json=excluded.metadata_json, updated_at=excluded.updated_at
  `).run(provider, String(providerUserId), userId, username, displayName, avatarUrl, JSON.stringify(metadata || {}), t);
  return userId;
}
