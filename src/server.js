import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateRuntimeConfig } from './config.js';
import {
  accountsForUser,
  createAppSession,
  createOauthState,
  consumeOauthState,
  linkProviderAccount,
  readAppSession,
  revokeAppSession,
  updateAccountMetadata
} from './db.js';
import { authorizedIdentities, getIdentity } from './policy.js';
import { enrichIdentityRouting, validatePublishRouting } from './routing.js';
import {
  discordAuthorizeUrl,
  discordBotGuildMember,
  discordOauthGuildMember,
  discordUser,
  exchangeDiscordCode,
  exchangeRobloxCode,
  pkcePair,
  robloxAuthorizeUrl,
  robloxGroupRoles,
  robloxUserInfo
} from './providers.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(express.json({ limit: '512kb' }));

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    out[decodeURIComponent(part.slice(0, i).trim())] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieOptions({ maxAge } = {}) {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: '/',
    ...(maxAge ? { maxAge } : {})
  };
}

function sessionFromRequest(req) {
  const raw = parseCookies(req)[config.sessionCookie];
  const row = readAppSession(raw);
  return row ? { ...row, rawToken: raw } : null;
}

function safeReturnTo(raw) {
  const fallback = `${config.frontendOrigin}${config.frontendPath}`;
  try {
    if (!raw) return fallback;
    const url = new URL(raw);
    if (url.origin !== config.frontendOrigin) return fallback;
    if (!url.pathname.startsWith(config.frontendPath)) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function setSessionCookie(res, token, expiresAt) {
  res.cookie(config.sessionCookie, token, cookieOptions({ maxAge: Math.max(1, expiresAt - Date.now()) }));
}

function stateCookie(provider) {
  return `cs_oauth_${provider}`;
}

function setStateCookie(res, provider, state) {
  res.cookie(stateCookie(provider), state, cookieOptions({ maxAge: config.oauthTtlMinutes * 60_000 }));
}

function clearStateCookie(res, provider) {
  res.clearCookie(stateCookie(provider), cookieOptions());
}

function authorizationUnavailable(message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = 'AUTHORIZATION_UNAVAILABLE';
  error.status = 503;
  return error;
}

async function freshAuthorization(userId, { forceDiscord = false, forceRoblox = false } = {}) {
  const accounts = Object.fromEntries(accountsForUser(userId).map((account) => [account.provider, account]));
  const discord = accounts.discord || null;
  const roblox = accounts.roblox || null;
  const now = Date.now();

  let discordRoleIds = Array.isArray(discord?.metadata?.role_ids)
    ? discord.metadata.role_ids.map(String)
    : [];
  let discordInGuild = Boolean(discord?.metadata?.in_guild);

  if (discord) {
    const checkedAt = Number(discord.metadata?.roles_checked_at || 0);
    const needsRefresh = forceDiscord || now - checkedAt >= config.authzCacheSeconds * 1000;

    if (needsRefresh) {
      if (!config.discord.botToken) {
        if (forceDiscord) {
          throw authorizationUnavailable('Discord bot token is unavailable for the required publish-time role check.');
        }
      } else {
        try {
          const member = await discordBotGuildMember(discord.provider_user_id);
          discordRoleIds = Array.isArray(member?.roles) ? member.roles.map(String) : [];
          discordInGuild = Boolean(member);
          const next = {
            ...discord.metadata,
            role_ids: discordRoleIds,
            in_guild: discordInGuild,
            roles_checked_at: now
          };
          updateAccountMetadata(userId, 'discord', next);
          discord.metadata = next;
        } catch (error) {
          if (forceDiscord) {
            throw authorizationUnavailable('Discord guild membership could not be verified.', error);
          }
          console.warn('Discord role refresh failed; using cached roles:', error.message);
        }
      }
    }
  }

  let robloxRoles = Array.isArray(roblox?.metadata?.group_roles)
    ? roblox.metadata.group_roles
    : [];

  if (roblox) {
    const checkedAt = Number(roblox.metadata?.roles_checked_at || 0);
    const needsRefresh = forceRoblox || now - checkedAt >= config.authzCacheSeconds * 1000;

    if (needsRefresh) {
      try {
        robloxRoles = await robloxGroupRoles(roblox.provider_user_id);
        const next = { ...roblox.metadata, group_roles: robloxRoles, roles_checked_at: now };
        updateAccountMetadata(userId, 'roblox', next);
        roblox.metadata = next;
      } catch (error) {
        if (forceRoblox) {
          throw authorizationUnavailable('Roblox group membership could not be verified.', error);
        }
        console.warn('Roblox role refresh failed; using cached roles:', error.message);
      }
    }
  }

  const identities = authorizedIdentities({
    discordRoleIds,
    robloxUserId: roblox?.provider_user_id || null,
    robloxGroupRoles: robloxRoles
  }).map((identity) => enrichIdentityRouting(identity, config));

  return {
    accounts,
    discordRoleIds,
    discordInGuild,
    robloxRoles,
    identities
  };
}

function sessionUserShape(userId, authz) {
  const discord = authz.accounts.discord;
  const roblox = authz.accounts.roblox;
  const preferred = discord || roblox;
  const studioAccess = config.requireDiscord
    ? Boolean(discord && authz.discordInGuild)
    : Boolean((discord && authz.discordInGuild) || roblox);

  return {
    id: userId,
    display_name: discord?.display_name || roblox?.display_name || preferred?.username || 'Authenticated User',
    username: discord?.username || roblox?.username || '',
    provider: discord ? 'Discord' : 'Roblox',
    studio_access: studioAccess,
    discord: discord ? {
      id: discord.provider_user_id,
      username: discord.username,
      display_name: discord.display_name,
      avatar_url: discord.avatar_url,
      guild_id: config.discord.guildId,
      in_guild: authz.discordInGuild,
      roles: authz.discordRoleIds
    } : null,
    roblox: roblox ? {
      id: roblox.provider_user_id,
      username: roblox.username,
      display_name: roblox.display_name,
      avatar_url: roblox.avatar_url
    } : null,
    allowed_identity_ids: authz.identities.map((identity) => identity.id),
    publishing_identities: authz.identities
  };
}

function validateBuilderDocument(document) {
  if (!document || typeof document !== 'object') return 'builder_document_required';
  if (!Array.isArray(document.containers) || document.containers.length !== 1) return 'exactly_one_container_required';
  const container = document.containers[0];
  if (!container || container.kind !== 'container') return 'invalid_container';
  const children = Array.isArray(container.children) ? container.children : [];
  if (children.some((child) => child?.kind === 'file')) return 'file_components_not_allowed';
  return null;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'communications-studio-api',
    guild_id: config.discord.guildId,
    config_warnings: validateRuntimeConfig()
  });
});

app.get('/auth/session', async (req, res, next) => {
  try {
    const session = sessionFromRequest(req);
    if (!session) return res.json({ authenticated: false });
    const authz = await freshAuthorization(session.user_id);
    res.json({ authenticated: true, user: sessionUserShape(session.user_id, authz) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/identities', async (req, res, next) => {
  try {
    const session = sessionFromRequest(req);
    if (!session) return res.status(401).json({ error: 'authentication_required' });
    const authz = await freshAuthorization(session.user_id);
    const user = sessionUserShape(session.user_id, authz);
    if (!user.studio_access) {
      return res.status(403).json({ error: 'discord_guild_membership_required', identities: [] });
    }
    res.json({ identities: authz.identities });
  } catch (error) {
    next(error);
  }
});

app.get('/auth/discord', (req, res) => {
  if (!config.discord.clientId || !config.discord.clientSecret) {
    return res.status(503).send('Discord OAuth is not configured.');
  }
  const current = sessionFromRequest(req);
  const returnTo = safeReturnTo(req.query.return_to);
  const state = createOauthState({
    provider: 'discord',
    sessionUserId: current?.user_id || null,
    returnTo
  });
  setStateCookie(res, 'discord', state);
  res.redirect(discordAuthorizeUrl(state));
});

app.get('/auth/discord/callback', async (req, res, next) => {
  try {
    const state = String(req.query.state || '');
    const cookieState = parseCookies(req)[stateCookie('discord')];
    if (!state || !cookieState || state !== cookieState) {
      return res.status(400).send('Invalid Discord OAuth state.');
    }

    const stored = consumeOauthState(state, 'discord');
    clearStateCookie(res, 'discord');
    if (!stored) return res.status(400).send('Discord OAuth state expired or was already used.');
    if (req.query.error) return res.redirect(stored.return_to);

    const code = String(req.query.code || '');
    if (!code) return res.status(400).send('Discord did not return an authorization code.');

    const token = await exchangeDiscordCode(code);
    const profile = await discordUser(token.access_token);
    const member = await discordOauthGuildMember(token.access_token);
    const metadata = {
      role_ids: Array.isArray(member?.roles) ? member.roles.map(String) : [],
      in_guild: Boolean(member),
      roles_checked_at: Date.now()
    };
    const avatarUrl = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=128`
      : '';

    const userId = linkProviderAccount({
      provider: 'discord',
      providerUserId: profile.id,
      currentUserId: stored.session_user_id,
      username: profile.username || '',
      displayName: profile.global_name || profile.username || '',
      avatarUrl,
      metadata
    });

    const session = createAppSession(userId);
    setSessionCookie(res, session.token, session.expiresAt);
    res.redirect(stored.return_to);
  } catch (error) {
    next(error);
  }
});

app.get('/auth/roblox', (req, res) => {
  if (!config.roblox.clientId || !config.roblox.clientSecret) {
    return res.status(503).send('Roblox OAuth is not configured.');
  }
  const current = sessionFromRequest(req);
  const returnTo = safeReturnTo(req.query.return_to);
  const { verifier, challenge } = pkcePair();
  const state = createOauthState({
    provider: 'roblox',
    sessionUserId: current?.user_id || null,
    returnTo,
    codeVerifier: verifier
  });
  setStateCookie(res, 'roblox', state);
  res.redirect(robloxAuthorizeUrl(state, challenge));
});

app.get('/auth/roblox/callback', async (req, res, next) => {
  try {
    const state = String(req.query.state || '');
    const cookieState = parseCookies(req)[stateCookie('roblox')];
    if (!state || !cookieState || state !== cookieState) {
      return res.status(400).send('Invalid Roblox OAuth state.');
    }

    const stored = consumeOauthState(state, 'roblox');
    clearStateCookie(res, 'roblox');
    if (!stored) return res.status(400).send('Roblox OAuth state expired or was already used.');
    if (req.query.error) return res.redirect(stored.return_to);

    const code = String(req.query.code || '');
    if (!code) return res.status(400).send('Roblox did not return an authorization code.');

    const token = await exchangeRobloxCode(code, stored.code_verifier);
    const profile = await robloxUserInfo(token.access_token);
    const groupRoles = await robloxGroupRoles(profile.sub);
    const metadata = { group_roles: groupRoles, roles_checked_at: Date.now() };

    const userId = linkProviderAccount({
      provider: 'roblox',
      providerUserId: profile.sub,
      currentUserId: stored.session_user_id,
      username: profile.preferred_username || '',
      displayName: profile.name || profile.nickname || profile.preferred_username || '',
      avatarUrl: profile.picture || '',
      metadata
    });

    const session = createAppSession(userId);
    setSessionCookie(res, session.token, session.expiresAt);
    res.redirect(stored.return_to);
  } catch (error) {
    next(error);
  }
});

app.post('/auth/logout', (req, res) => {
  const session = sessionFromRequest(req);
  revokeAppSession(session?.rawToken);
  res.clearCookie(config.sessionCookie, cookieOptions());
  res.status(204).end();
});

app.post('/api/publish', async (req, res, next) => {
  try {
    const session = sessionFromRequest(req);
    if (!session) return res.status(401).json({ error: 'authentication_required' });

    const identityId = String(req.body?.identity_id || '');
    const requestedIdentity = getIdentity(identityId);
    if (!requestedIdentity) {
      return res.status(403).json({ error: 'identity_not_authorized' });
    }

    const authz = await freshAuthorization(session.user_id, {
      forceDiscord: true,
      forceRoblox: requestedIdentity.access?.type === 'roblox'
    });
    const user = sessionUserShape(session.user_id, authz);

    if (!user.studio_access) {
      return res.status(403).json({ error: 'discord_guild_membership_required' });
    }
    if (!user.allowed_identity_ids.includes(identityId)) {
      return res.status(403).json({ error: 'identity_not_authorized' });
    }

    const routing = validatePublishRouting(identityId, req.body, config);
    if (!routing.ok) return res.status(403).json({ error: routing.error });

    const documentError = validateBuilderDocument(req.body?.builder_document);
    if (documentError) return res.status(400).json({ error: documentError });

    // Deliberately disabled until the Discord application/webhook publishing
    // layer is configured. Everything above this point is production policy.
    return res.status(501).json({
      error: 'publishing_not_configured',
      identity_id: identityId,
      channel_id: routing.channel_id,
      selected_ping_role_ids: routing.pings.map((ping) => ping.id),
      ping_everyone: routing.ping_everyone
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const conflict = error.code === 'ACCOUNT_ALREADY_LINKED' || error.code === 'PROVIDER_ALREADY_LINKED';
  const status = Number(error.status) || (conflict ? 409 : 500);
  res.status(status).json({
    error: error.code || 'internal_error',
    message: config.nodeEnv === 'development' ? error.message : undefined
  });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Communications Studio API listening on :${config.port}`);
  for (const warning of validateRuntimeConfig()) console.warn(`CONFIG: ${warning}`);
});
