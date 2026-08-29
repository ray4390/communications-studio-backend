const CHANNEL_LABELS = Object.freeze({
  white_house: '#white-house',
  executive: '#executive-branch',
  legislative: '#legislative-branch',
  judicial: '#judicial-branch',
  fec: '#fec'
});

const PING_LABELS = Object.freeze({
  executive: '@Executive Ping',
  white_house: '@White House Ping',
  legislative: '@Legislative Ping',
  judicial: '@Judicial Ping'
});

export const CHANNEL_ACCESS_ROLES = Object.freeze({
  executive: '1155312730895548426',
  white_house: '1155312788554661969',
  legislative: '1155312851926401154',
  judicial: '1155312918867493006'
});

const ALL_BRANCH_CHANNELS = Object.freeze(['white_house', 'executive', 'legislative', 'judicial']);
const ALL_BRANCH_PINGS = Object.freeze(['executive', 'white_house', 'legislative', 'judicial']);

const WHITE_HOUSE = new Set(['white_house', 'eop', 'whmo']);
const OVP = new Set(['ovp']);
const LEGISLATIVE = new Set(['house', 'senate', 'uscp', 'uscp_oig']);
const JUDICIAL = new Set(['judiciary', 'supreme_court']);

function discordRoleSet(discordRoleIds = []) {
  return new Set((Array.isArray(discordRoleIds) ? discordRoleIds : [...discordRoleIds || []]).map(String));
}

export function requiredAccessRoleForChannelKey(channelKey) {
  return CHANNEL_ACCESS_ROLES[String(channelKey || '')] || null;
}

function channelKeyAllowed(channelKey, discordRoleIds = []) {
  const requiredRole = requiredAccessRoleForChannelKey(channelKey);
  return !requiredRole || discordRoleSet(discordRoleIds).has(requiredRole);
}

export function routingPolicy(identityId) {
  const id = String(identityId || '');

  if (id === 'fec') {
    return { channelKeys: ['fec'], pingKeys: [...ALL_BRANCH_PINGS], allowEveryone: true };
  }

  if (id === 'nara') {
    return { channelKeys: [...ALL_BRANCH_CHANNELS], pingKeys: [...ALL_BRANCH_PINGS], allowEveryone: false };
  }

  if (WHITE_HOUSE.has(id)) {
    return { channelKeys: ['white_house'], pingKeys: ['white_house'], allowEveryone: false };
  }

  if (OVP.has(id)) {
    return { channelKeys: ['white_house'], pingKeys: ['executive'], allowEveryone: false };
  }

  if (LEGISLATIVE.has(id)) {
    return { channelKeys: ['legislative'], pingKeys: ['legislative'], allowEveryone: false };
  }

  if (JUDICIAL.has(id)) {
    return { channelKeys: ['judicial'], pingKeys: ['judicial'], allowEveryone: false };
  }

  return { channelKeys: ['executive'], pingKeys: ['executive'], allowEveryone: false };
}

export function publicRouting(identityId, config, discordRoleIds = []) {
  const policy = routingPolicy(identityId);
  const channels = policy.channelKeys
    .filter((key) => channelKeyAllowed(key, discordRoleIds))
    .map((key) => ({ key, id: String(config.channels?.[key] || ''), label: CHANNEL_LABELS[key] }))
    .filter((item) => item.id);
  const pingOptions = policy.pingKeys
    .map((key) => ({ key, id: String(config.pingRoles?.[key] || ''), label: PING_LABELS[key] }))
    .filter((item) => item.id);

  return {
    channels,
    default_channel_id: channels[0]?.id || null,
    ping_options: pingOptions,
    allow_everyone: policy.allowEveryone
  };
}

export function enrichIdentityRouting(identity, config, discordRoleIds = []) {
  return { ...identity, ...publicRouting(identity.id, config, discordRoleIds) };
}

export function hasPublishChannelAccess(identityId, config, discordRoleIds = []) {
  return publicRouting(identityId, config, discordRoleIds).channels.length > 0;
}

export function validatePublishRouting(identityId, request, config, discordRoleIds = []) {
  const policy = routingPolicy(identityId);
  const channelId = String(request?.channel_id || '');
  const configuredChannels = policy.channelKeys
    .map((key) => ({ key, id: String(config.channels?.[key] || '') }))
    .filter((item) => item.id);
  const selectedChannel = configuredChannels.find((channel) => channel.id === channelId) || null;
  if (!selectedChannel) {
    return { ok: false, error: 'channel_not_authorized' };
  }

  const requiredRoleId = requiredAccessRoleForChannelKey(selectedChannel.key);
  if (requiredRoleId && !discordRoleSet(discordRoleIds).has(requiredRoleId)) {
    return { ok: false, error: 'discord_channel_access_role_required', required_role_id: requiredRoleId };
  }

  const publicPolicy = publicRouting(identityId, config, discordRoleIds);
  const requestedKeys = Array.isArray(request?.ping_keys) ? request.ping_keys.map(String) : [];
  const uniquePingKeys = [...new Set(requestedKeys)];
  const allowedPingKeys = new Set(publicPolicy.ping_options.map((option) => option.key));
  if (uniquePingKeys.some((key) => !allowedPingKeys.has(key))) {
    return { ok: false, error: 'ping_not_authorized' };
  }

  const pingEveryone = Boolean(request?.ping_everyone);
  if (pingEveryone && !publicPolicy.allow_everyone) {
    return { ok: false, error: 'everyone_not_authorized' };
  }

  const selectedPings = publicPolicy.ping_options.filter((option) => uniquePingKeys.includes(option.key));
  return {
    ok: true,
    channel_id: channelId,
    pings: selectedPings,
    ping_everyone: pingEveryone,
    allowed_mentions: {
      parse: pingEveryone ? ['everyone'] : [],
      roles: selectedPings.map((ping) => ping.id)
    }
  };
}
