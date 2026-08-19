import crypto from 'node:crypto';
import { config } from './config.js';

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(`Upstream request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function discordAuthorizeUrl(state) {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: config.discord.clientId,
    scope: 'identify guilds.members.read',
    state,
    redirect_uri: config.discord.redirectUri,
    prompt: 'consent'
  });
  return `https://discord.com/oauth2/authorize?${query}`;
}

export async function exchangeDiscordCode(code) {
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: config.discord.redirectUri });
  const basic = Buffer.from(`${config.discord.clientId}:${config.discord.clientSecret}`).toString('base64');
  return jsonFetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
}

export async function discordUser(accessToken) {
  return jsonFetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function discordOauthGuildMember(accessToken) {
  if (!config.discord.guildId) return null;
  try {
    return await jsonFetch(`https://discord.com/api/v10/users/@me/guilds/${config.discord.guildId}/member`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  } catch (error) {
    if (error.status === 404 || error.status === 403) return null;
    throw error;
  }
}

export async function discordBotGuildMember(userId) {
  if (!config.discord.botToken || !config.discord.guildId || !userId) return null;
  try {
    return await jsonFetch(`https://discord.com/api/v10/guilds/${config.discord.guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${config.discord.botToken}` }
    });
  } catch (error) {
    if (error.status === 404) return null;
    // 401/403 means our application credentials or guild access are broken,
    // not that the target user lacks membership. Let the caller fail closed.
    throw error;
  }
}

export async function discordSearchGuildMembers(query, limit = 20) {
  if (!config.discord.botToken || !config.discord.guildId) return [];
  const clean = String(query || '').trim().slice(0, 100);
  if (!clean) return [];
  const params = new URLSearchParams({ query: clean, limit: String(Math.max(1, Math.min(100, Number(limit) || 20))) });
  const data = await jsonFetch(`https://discord.com/api/v10/guilds/${config.discord.guildId}/members/search?${params}`, {
    headers: { Authorization: `Bot ${config.discord.botToken}` }
  });
  return Array.isArray(data) ? data : [];
}

let guildEmojiCache = { expiresAt: 0, items: [] };
export async function discordGuildEmojis() {
  if (!config.discord.botToken || !config.discord.guildId) return [];
  if (guildEmojiCache.expiresAt > Date.now()) return guildEmojiCache.items;
  const data = await jsonFetch(`https://discord.com/api/v10/guilds/${config.discord.guildId}/emojis`, {
    headers: { Authorization: `Bot ${config.discord.botToken}` }
  });
  const items = Array.isArray(data) ? data : [];
  guildEmojiCache = { expiresAt: Date.now() + 5 * 60_000, items };
  return items;
}

export function pkcePair() {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export async function exchangeRobloxCode(code, verifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    client_id: config.roblox.clientId,
    client_secret: config.roblox.clientSecret
  });
  return jsonFetch('https://apis.roblox.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
}

export function robloxAuthorizeUrl(state, challenge) {
  const query = new URLSearchParams({
    client_id: config.roblox.clientId,
    redirect_uri: config.roblox.redirectUri,
    scope: 'openid profile',
    response_type: 'code',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  return `https://apis.roblox.com/oauth/v1/authorize?${query}`;
}

export async function robloxUserInfo(accessToken) {
  return jsonFetch('https://apis.roblox.com/oauth/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function robloxGroupRoles(userId) {
  if (!userId) return [];
  const data = await jsonFetch(`https://groups.roblox.com/v2/users/${encodeURIComponent(userId)}/groups/roles`);
  return Array.isArray(data?.data) ? data.data : [];
}
