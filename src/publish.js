import { config } from './config.js';

const WEBHOOK_NAME = 'Communications Studio Publisher';
const webhookCache = new Map();

function cleanLine(value, max = 256) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

function requireText(value, code, max = 4000) {
  const text = String(value || '');
  if (!text.trim()) throw publishError(code, 400);
  if (text.length > max) throw publishError(`${code}_too_long`, 400);
  return text;
}

function publishError(code, status = 400, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  error.status = status;
  return error;
}

function safeHttpUrl(value, code = 'invalid_url') {
  try {
    const url = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
    return url.toString();
  } catch {
    throw publishError(code, 400);
  }
}

function countComponent(component) {
  if (!component || typeof component !== 'object') return 0;
  if (component.kind === 'section') return 1 + Math.min(3, Array.isArray(component.texts) ? component.texts.length : 0) + 1;
  if (component.kind === 'actionRow') return 1 + (component.mode === 'select' ? 1 : Math.min(5, Array.isArray(component.buttons) ? component.buttons.length : 0));
  return 1;
}

export function validatePublishDocument(document) {
  if (!document || typeof document !== 'object') return 'builder_document_required';
  if (document._publish_confirmation !== 'explicit-user-confirmation' || document._publish_action !== 'publish-now-button') {
    return 'explicit_publish_confirmation_required';
  }
  if (!Array.isArray(document.containers) || document.containers.length !== 1) return 'exactly_one_container_required';
  const container = document.containers[0];
  if (!container || container.kind !== 'container') return 'invalid_container';
  const children = Array.isArray(container.children) ? container.children : [];
  if (!children.length) return 'container_body_required';
  if (children.some((child) => child?.kind === 'file')) return 'file_components_not_allowed';
  const totalComponents = 1 + 2 + children.reduce((sum, child) => sum + countComponent(child), 0);
  if (totalComponents > 40) return 'too_many_components';
  const message = document.message || {};
  if (![message.headerTitle, message.addressLine1, message.addressLine2, message.position].every((value) => cleanLine(value))) {
    return 'required_framing_fields_missing';
  }
  if (Array.isArray(message.userPings) && message.userPings.length > 25) return 'too_many_user_mentions';
  return null;
}

function buttonPayload(button) {
  const style = Number(button?.style) || 2;
  if (![1, 2, 3, 4, 5, 6].includes(style)) throw publishError('invalid_button_style', 400);
  const data = {
    type: 2,
    style,
    label: cleanLine(button?.label || 'Button', 80)
  };
  if (!data.label) throw publishError('button_label_required', 400);
  if (button?.disabled) data.disabled = true;
  if (button?.emoji) data.emoji = { name: cleanLine(button.emoji, 32) };
  if (style === 5) {
    data.url = safeHttpUrl(button?.url, 'invalid_button_url');
  } else {
    const customId = cleanLine(button?.customId, 100);
    if (!customId) throw publishError('button_custom_id_required', 400);
    data.custom_id = customId;
  }
  return data;
}

function selectPayload(menu) {
  const type = Number(menu?.type);
  if (![3, 5, 6, 7, 8].includes(type)) throw publishError('invalid_select_type', 400);
  const customId = cleanLine(menu?.customId, 100);
  if (!customId) throw publishError('select_custom_id_required', 400);
  const minValues = Math.max(0, Math.min(25, Number(menu?.minValues ?? 1) || 0));
  const maxValues = Math.max(minValues, Math.min(25, Number(menu?.maxValues ?? 1) || 1));
  const data = { type, custom_id: customId, min_values: minValues, max_values: maxValues };
  if (menu?.placeholder) data.placeholder = cleanLine(menu.placeholder, 150);
  if (menu?.disabled) data.disabled = true;
  if (type === 3) {
    const options = Array.isArray(menu?.options) ? menu.options.slice(0, 25) : [];
    if (!options.length) throw publishError('select_options_required', 400);
    data.options = options.map((option) => {
      const label = cleanLine(option?.label || 'Option', 100);
      const value = cleanLine(option?.value || '', 100);
      if (!value) throw publishError('select_option_value_required', 400);
      const out = { label, value };
      if (option?.description) out.description = cleanLine(option.description, 100);
      if (option?.emoji) out.emoji = { name: cleanLine(option.emoji, 32) };
      if (option?.default) out.default = true;
      return out;
    });
  }
  if (type === 8 && Array.isArray(menu?.channelTypes) && menu.channelTypes.length) {
    data.channel_types = menu.channelTypes.map(Number).filter(Number.isInteger).slice(0, 25);
  }
  return data;
}

function accessoryPayload(accessory) {
  if (!accessory || accessory.kind === 'thumbnail') {
    const data = {
      type: 11,
      media: { url: safeHttpUrl(accessory?.url, 'invalid_thumbnail_url') }
    };
    if (accessory?.description) data.description = cleanLine(accessory.description, 1024);
    if (accessory?.spoiler) data.spoiler = true;
    return data;
  }
  if (accessory.kind === 'button') return buttonPayload(accessory);
  throw publishError('invalid_section_accessory', 400);
}

function componentPayload(component) {
  if (!component || typeof component !== 'object') throw publishError('invalid_component', 400);
  if (component.kind === 'text') {
    return { type: 10, content: requireText(component.content, 'text_display_required') };
  }
  if (component.kind === 'separator') {
    return { type: 14, divider: component.divider !== false, spacing: Number(component.spacing) === 2 ? 2 : 1 };
  }
  if (component.kind === 'section') {
    const texts = Array.isArray(component.texts) ? component.texts.slice(0, 3) : [];
    if (!texts.length) throw publishError('section_text_required', 400);
    return {
      type: 9,
      components: texts.map((content) => ({ type: 10, content: requireText(content, 'section_text_required') })),
      accessory: accessoryPayload(component.accessory)
    };
  }
  if (component.kind === 'gallery') {
    const items = Array.isArray(component.items) ? component.items.slice(0, 10) : [];
    if (!items.length) throw publishError('gallery_items_required', 400);
    return {
      type: 12,
      items: items.map((item) => {
        const out = { media: { url: safeHttpUrl(item?.url, 'invalid_gallery_url') } };
        if (item?.description) out.description = cleanLine(item.description, 1024);
        if (item?.spoiler) out.spoiler = true;
        return out;
      })
    };
  }
  if (component.kind === 'actionRow') {
    if (component.mode === 'select') return { type: 1, components: [selectPayload(component.select)] };
    const buttons = Array.isArray(component.buttons) ? component.buttons.slice(0, 5) : [];
    if (!buttons.length) throw publishError('action_row_buttons_required', 400);
    return { type: 1, components: buttons.map(buttonPayload) };
  }
  if (component.kind === 'file') throw publishError('file_components_not_allowed', 400);
  throw publishError('unsupported_component', 400);
}

function customEmojiAvatar(identity) {
  const token = String(identity?.office_emoji || '');
  const match = token.match(/^<(a?):[^:>]+:(\d+)>$/);
  if (!match) return '';
  const extension = match[1] ? 'gif' : 'webp';
  return `https://cdn.discordapp.com/emojis/${match[2]}.${extension}?size=128&quality=lossless`;
}

export function buildDiscordPublishPayload({ document, identity, routing, robloxUsername, discordUsername }) {
  const documentError = validatePublishDocument(document);
  if (documentError) throw publishError(documentError, 400);
  if (!identity) throw publishError('identity_not_authorized', 403);
  if (!routing?.ok) throw publishError(routing?.error || 'channel_not_authorized', 403);

  const message = document.message || {};
  const officeEmoji = cleanLine(identity.office_emoji || `:${identity.avatar_initials || 'USAR'}:`, 64);
  const title = cleanLine(message.headerTitle, 256);
  const addressLine1 = cleanLine(message.addressLine1, 256);
  const addressLine2 = cleanLine(message.addressLine2, 256);
  const position = cleanLine(message.position || identity.position || identity.label, 160);
  const roleplayName = cleanLine(message.roleplayName, 100);
  const roblox = cleanLine(robloxUsername || 'Roblox user', 100);
  const discord = cleanLine(discordUsername || 'unknown', 100).replace(/^@+/, '');
  const userIds = Array.isArray(routing.allowed_mentions?.users) ? routing.allowed_mentions.users.map(String) : [];
  const roleIds = Array.isArray(routing.allowed_mentions?.roles) ? routing.allowed_mentions.roles.map(String) : [];

  const mentionTokens = [
    ...(routing.ping_everyone ? ['@everyone'] : []),
    ...roleIds.map((id) => `<@&${id}>`),
    ...userIds.map((id) => `<@${id}>`)
  ];
  const headerLines = [
    `${officeEmoji} | **${title}**`,
    `-# ${addressLine1}`,
    `-# ${addressLine2}`
  ];
  if (mentionTokens.length) headerLines.push(`-# cc: ${mentionTokens.join(' ')}`);

  const footerLines = [];
  if (roleplayName) {
    footerLines.push(`*${roleplayName}*`);
    if (roblox && roblox.toLowerCase() !== roleplayName.toLowerCase()) footerLines.push(`-# ${roblox}`);
  } else {
    footerLines.push(`*${roblox}*`);
  }
  footerLines.push(`-# ${officeEmoji} ${position}`);
  footerLines.push(`-# Posted by @${discord}`);

  const source = document.containers[0];
  const body = source.children.map(componentPayload);
  const container = {
    type: 17,
    components: [
      { type: 10, content: headerLines.join('\n') },
      ...body,
      { type: 10, content: footerLines.join('\n') }
    ]
  };
  if (source.accentEnabled !== false) {
    const hex = String(source.accentColor || '#1f64cc').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) throw publishError('invalid_accent_color', 400);
    container.accent_color = Number.parseInt(hex, 16);
  }
  if (source.spoiler) container.spoiler = true;

  const payload = {
    flags: 32768,
    components: [container],
    allowed_mentions: {
      parse: routing.ping_everyone ? ['everyone'] : [],
      roles: roleIds,
      users: userIds,
      replied_user: false
    },
    username: cleanLine(identity.display_name || identity.displayName || identity.label || 'USAR Communications', 80)
  };
  const avatarUrl = identity.avatar_url || identity.avatarUrl || customEmojiAvatar(identity);
  if (avatarUrl) payload.avatar_url = safeHttpUrl(avatarUrl, 'invalid_identity_avatar');
  return payload;
}

async function discordJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = publishError('discord_api_error', 502);
    error.discordStatus = response.status;
    error.discordData = data;
    throw error;
  }
  return data;
}

function botHeaders(extra = {}) {
  return {
    Authorization: `Bot ${config.discord.botToken}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function findOrCreateWebhook(channelId) {
  if (!config.discord.botToken) throw publishError('discord_bot_unavailable', 503);
  const cached = webhookCache.get(channelId);
  if (cached?.id && cached?.token) return cached;

  let hooks;
  try {
    hooks = await discordJson(`https://discord.com/api/v10/channels/${channelId}/webhooks`, {
      headers: botHeaders()
    });
  } catch (error) {
    if (error.discordStatus === 403) throw publishError('discord_manage_webhooks_required', 503, error);
    throw error;
  }

  let webhook = Array.isArray(hooks)
    ? hooks.find((item) => item?.type === 1 && item?.name === WEBHOOK_NAME && item?.token)
    : null;
  if (!webhook) {
    try {
      webhook = await discordJson(`https://discord.com/api/v10/channels/${channelId}/webhooks`, {
        method: 'POST',
        headers: botHeaders({ 'X-Audit-Log-Reason': 'Communications Studio official publication webhook' }),
        body: JSON.stringify({ name: WEBHOOK_NAME })
      });
    } catch (error) {
      if (error.discordStatus === 403) throw publishError('discord_manage_webhooks_required', 503, error);
      throw error;
    }
  }
  if (!webhook?.id || !webhook?.token) throw publishError('discord_webhook_unavailable', 503);
  const value = { id: String(webhook.id), token: String(webhook.token) };
  webhookCache.set(channelId, value);
  return value;
}

async function executeWebhook(channelId, payload, retry = true) {
  const webhook = await findOrCreateWebhook(channelId);
  try {
    return await discordJson(`https://discord.com/api/v10/webhooks/${webhook.id}/${webhook.token}?wait=true&with_components=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    if (retry && error.discordStatus === 404) {
      webhookCache.delete(channelId);
      return executeWebhook(channelId, payload, false);
    }
    if (error.discordStatus === 403) throw publishError('discord_webhook_send_forbidden', 503, error);
    throw publishError('discord_publish_failed', 502, error);
  }
}

export async function publishToDiscord({ document, identity, routing, robloxUsername, discordUsername }) {
  const payload = buildDiscordPublishPayload({ document, identity, routing, robloxUsername, discordUsername });
  const message = await executeWebhook(routing.channel_id, payload);
  const messageId = String(message?.id || '');
  if (!messageId) throw publishError('discord_publish_response_invalid', 502);
  return {
    message_id: messageId,
    channel_id: String(message?.channel_id || routing.channel_id),
    guild_id: String(message?.guild_id || config.discord.guildId),
    message_url: `https://discord.com/channels/${config.discord.guildId}/${routing.channel_id}/${messageId}`
  };
}
