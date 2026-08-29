import 'dotenv/config';
import path from 'node:path';

const DEFAULT_USAR_DISCORD_GUILD_ID = '886068973886640129';

const DEFAULT_CHANNELS = Object.freeze({
  white_house: '899467464826556427',
  executive: '886076674792390707',
  legislative: '886077286414172171',
  judicial: '886077834911678464',
  fec: '1076283102822940713'
});

const DEFAULT_PING_ROLES = Object.freeze({
  executive: '937155572342587392',
  white_house: '1156347407899041812',
  legislative: '1156346015234924615',
  judicial: '1156346227286360236'
});

function int(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const root = process.cwd();
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
const frontendOrigin = (process.env.FRONTEND_ORIGIN || 'http://localhost:8000').replace(/\/$/, '');
const frontendPath = process.env.FRONTEND_PATH || '/';

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 8787),
  compatibilityPort: int(process.env.COMPATIBILITY_PORT, null),
  publicBaseUrl,
  frontendOrigin,
  frontendPath,
  databasePath: process.env.DATABASE_PATH || path.join(root, 'data', 'communications-studio.sqlite'),
  sessionCookie: process.env.SESSION_COOKIE || 'cs_session',
  sessionTtlDays: int(process.env.SESSION_TTL_DAYS, 30),
  oauthTtlMinutes: int(process.env.OAUTH_TTL_MINUTES, 10),
  cookieSecure: bool(process.env.COOKIE_SECURE, publicBaseUrl.startsWith('https://')),
  cookieSameSite: process.env.COOKIE_SAME_SITE || (frontendOrigin === new URL(publicBaseUrl).origin ? 'lax' : 'none'),
  requireDiscord: bool(process.env.REQUIRE_DISCORD, true),
  authzCacheSeconds: int(process.env.AUTHZ_CACHE_SECONDS, 300),
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    guildId: process.env.DISCORD_GUILD_ID || DEFAULT_USAR_DISCORD_GUILD_ID,
    botToken: process.env.DISCORD_BOT_TOKEN || '',
    redirectUri: process.env.DISCORD_REDIRECT_URI || `${publicBaseUrl}/auth/discord/callback`
  },
  roblox: {
    clientId: process.env.ROBLOX_CLIENT_ID || '',
    clientSecret: process.env.ROBLOX_CLIENT_SECRET || '',
    redirectUri: process.env.ROBLOX_REDIRECT_URI || `${publicBaseUrl}/auth/roblox/callback`
  },
  channels: {
    white_house: process.env.CHANNEL_WHITE_HOUSE || DEFAULT_CHANNELS.white_house,
    executive: process.env.CHANNEL_EXECUTIVE || DEFAULT_CHANNELS.executive,
    legislative: process.env.CHANNEL_LEGISLATIVE || DEFAULT_CHANNELS.legislative,
    judicial: process.env.CHANNEL_JUDICIAL || DEFAULT_CHANNELS.judicial,
    fec: process.env.CHANNEL_FEC || DEFAULT_CHANNELS.fec
  },
  pingRoles: {
    white_house: process.env.PING_ROLE_WHITE_HOUSE || DEFAULT_PING_ROLES.white_house,
    executive: process.env.PING_ROLE_EXECUTIVE || DEFAULT_PING_ROLES.executive,
    legislative: process.env.PING_ROLE_LEGISLATIVE || DEFAULT_PING_ROLES.legislative,
    judicial: process.env.PING_ROLE_JUDICIAL || DEFAULT_PING_ROLES.judicial
  }
});

export function validateRuntimeConfig() {
  const problems = [];
  if (!config.discord.clientId || !config.discord.clientSecret) problems.push('Discord OAuth is not fully configured.');
  if (!config.discord.guildId) problems.push('The USAR Discord guild ID is not configured.');
  if (!config.discord.botToken) problems.push('Discord bot token is not configured; authoritative publish-time guild role checks are unavailable.');
  if (!config.roblox.clientId || !config.roblox.clientSecret) problems.push('Roblox OAuth is not fully configured.');
  if (config.cookieSameSite === 'none' && !config.cookieSecure) problems.push('SameSite=None cookies require COOKIE_SECURE=true in browsers.');
  for (const [key, channelId] of Object.entries(config.channels)) if (!channelId) problems.push(`Discord channel ${key} is not configured.`);
  for (const [key, roleId] of Object.entries(config.pingRoles)) if (!roleId) problems.push(`Discord ping role ${key} is not configured.`);
  return problems;
}
