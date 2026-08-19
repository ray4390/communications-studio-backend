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

const ALL_BRANCH_CHANNELS = Object.freeze(['white_house', 'executive', 'legislative', 'judicial']);
const ALL_BRANCH_PINGS = Object.freeze(['executive', 'white_house', 'legislative', 'judicial']);

const WHITE_HOUSE = new Set(['white_house', 'eop', 'whmo']);
const OVP = new Set(['ovp']);
const LEGISLATIVE = new Set(['house', 'senate', 'uscp', 'uscp_oig']);
const JUDICIAL = new Set(['judiciary', 'supreme_court']);

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

export function publicRouting(identityId, config) {
  const policy = routingPolicy(identityId);
  const channels = policy.channelKeys
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

export function enrichIdentityRouting(identity, config) {
  return { ...identity, ...publicRouting(identity.id, config) };
}

export function validatePublishRouting(identityId, request, config) {
  const publicPolicy = publicRouting(identityId, config);
  const channelId = String(request?.channel_id || '');
  const allowedChannelIds = new Set(publicPolicy.channels.map((channel) => channel.id));
  if (!channelId || !allowedChannelIds.has(channelId)) {
    return { ok: false, error: 'channel_not_authorized' };
  }

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
