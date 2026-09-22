import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscordPublishPayload, collectBodyMentions, includeBodyMentions, publishToDiscord, validatePublishDocument } from '../src/publish.js';
import { config } from '../src/config.js';

function documentFixture() {
  return {
    message: {
      headerTitle: 'Department of Justice',
      addressLine1: '950 Pennsylvania Avenue NW',
      addressLine2: 'Washington, DC 20530-0001',
      position: 'Attorney General of the United States',
      roleplayName: 'Test Publisher',
      userPings: []
    },
    containers: [{
      kind: 'container',
      accentEnabled: true,
      accentColor: '#1f64cc',
      spoiler: false,
      children: [{ kind: 'text', content: 'Test announcement body.' }]
    }]
  };
}

const identity = {
  id: 'doj',
  label: 'Department of Justice',
  display_name: 'United States Department of Justice',
  avatar_initials: 'DOJ',
  office_emoji: '<:DOJ:123456789012345678>',
  position: 'Attorney General'
};

const routing = {
  ok: true,
  channel_id: '886076674792390707',
  ping_everyone: false,
  allowed_mentions: {
    parse: [],
    roles: ['937155572342587392'],
    users: ['123456789012345678']
  }
};

test('saved drafts cannot pass the live publish confirmation latch', () => {
  const document = documentFixture();
  assert.equal(validatePublishDocument(document), 'explicit_publish_confirmation_required');
});

test('both ephemeral Publish now markers are required', () => {
  const document = documentFixture();
  document._publish_confirmation = 'explicit-user-confirmation';
  assert.equal(validatePublishDocument(document), 'explicit_publish_confirmation_required');

  document._publish_action = 'publish-now-button';
  assert.equal(validatePublishDocument(document), null);
});

test('server renders authoritative Components V2 framing after confirmation', () => {
  const document = documentFixture();
  document._publish_confirmation = 'explicit-user-confirmation';
  document._publish_action = 'publish-now-button';

  const payload = buildDiscordPublishPayload({
    document,
    identity,
    routing,
    robloxUsername: 'RobloxTestUser',
    discordUsername: 'discord.test'
  });

  assert.equal(payload.flags, 32768);
  assert.equal(payload.username, 'United States Department of Justice');
  assert.deepEqual(payload.allowed_mentions.roles, ['937155572342587392']);
  assert.deepEqual(payload.allowed_mentions.users, ['123456789012345678']);
  assert.deepEqual(payload.allowed_mentions.parse, []);
  assert.equal(payload.components.length, 1);
  assert.equal(payload.components[0].type, 17);

  const header = payload.components[0].components[0].content;
  assert.match(header, /<:DOJ:123456789012345678> \| \*\*Department of Justice\*\*/);
  assert.match(header, /-# 950 Pennsylvania Avenue NW/);
  assert.match(header, /<@&937155572342587392>/);
  assert.match(header, /<@123456789012345678>/);

  const footer = payload.components[0].components.at(-1).content;
  assert.match(footer, /\*Test Publisher\*/);
  assert.match(footer, /-# RobloxTestUser/);
  assert.match(footer, /Attorney General of the United States/);
  assert.match(footer, /-# Posted by @discord\.test/);
});

test('mentions in container text and section text are included in the Discord whitelist', async () => {
  const document = documentFixture();
  document.containers[0].children = [
    { kind: 'text', content: 'Attention <@&937155572342587392> and <@!234567890123456789>.' },
    { kind: 'section', texts: ['Also <@345678901234567890> and @here.'], accessory: { kind: 'thumbnail', url: 'https://example.com/icon.png' } }
  ];
  document._publish_confirmation = 'explicit-user-confirmation';
  document._publish_action = 'publish-now-button';
  assert.deepEqual(collectBodyMentions(document), {
    users: ['234567890123456789', '345678901234567890'],
    roles: ['937155572342587392'],
    everyone: true
  });
  const checked = [];
  const resolved = await includeBodyMentions({
    document, routing, permittedRoleIds: ['937155572342587392'], allowEveryone: true,
    lookupMember: async (id) => { checked.push(id); return { id }; }
  });
  assert.deepEqual(checked, ['123456789012345678', '234567890123456789', '345678901234567890']);
  const payload = buildDiscordPublishPayload({ document, identity, routing: resolved });
  assert.deepEqual(payload.allowed_mentions.roles, ['937155572342587392']);
  assert.deepEqual(payload.allowed_mentions.users, checked);
  assert.deepEqual(payload.allowed_mentions.parse, ['everyone']);
  assert.match(payload.components[0].components[1].content, /<@&937155572342587392>/);
});

test('body mentions cannot bypass the office role and everyone policy', async () => {
  const document = documentFixture();
  const options = { document, routing, permittedRoleIds: ['937155572342587392'], allowEveryone: false, lookupMember: async () => ({}) };
  document.containers[0].children[0].content = '<@&999999999999999999>';
  await assert.rejects(includeBodyMentions(options), { code: 'ping_not_authorized' });
  document.containers[0].children[0].content = '@everyone';
  await assert.rejects(includeBodyMentions(options), { code: 'everyone_not_authorized' });
  document.containers[0].children[0].content = '<@234567890123456789>';
  await assert.rejects(includeBodyMentions({ ...options, lookupMember: async () => null }), { code: 'user_mention_not_in_guild' });
});

test('a plain bot role ping is sent before the container and the container does not ping the role again', async () => {
  const document = documentFixture();
  document._publish_confirmation = 'explicit-user-confirmation';
  document._publish_action = 'publish-now-button';
  const channel_id = '987654321098765432';
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalToken = config.discord.botToken;
  config.discord.botToken = 'test-bot-token';
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET', body: options.body && JSON.parse(options.body), authorization: options.headers?.Authorization });
    const data = url.endsWith('/webhooks')
      ? [{ id: '456789012345678901', token: 'webhook-token', type: 1, name: 'Communications Studio Publisher' }]
      : url.endsWith('/messages')
        ? { id: '567890123456789012', mention_roles: routing.allowed_mentions.roles }
        : { id: '678901234567890123', channel_id };
    return new Response(JSON.stringify(data), { status: 200 });
  };
  try {
    const published = await publishToDiscord({ document, identity, routing: { ...routing, channel_id } });
    assert.equal(published.message_id, '678901234567890123');
    assert.deepEqual(requests.map((request) => request.method), ['GET', 'POST', 'POST']);
    assert.equal(requests[1].authorization, 'Bot test-bot-token');
    assert.equal(requests[1].body.content, '<@&937155572342587392>');
    assert.deepEqual(requests[1].body.allowed_mentions.roles, ['937155572342587392']);
    assert.deepEqual(requests[2].body.allowed_mentions.roles, []);
    assert.match(requests[2].body.components[0].components[0].content, /<@&937155572342587392>/);
  } finally {
    globalThis.fetch = originalFetch;
    config.discord.botToken = originalToken;
  }
});

test('an unrecognized role ping stops publication and removes the standalone message', async () => {
  const document = documentFixture();
  document._publish_confirmation = 'explicit-user-confirmation';
  document._publish_action = 'publish-now-button';
  const channel_id = '876543210987654321';
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalToken = config.discord.botToken;
  config.discord.botToken = 'test-bot-token';
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET' });
    if (url.endsWith('/webhooks')) return new Response(JSON.stringify([{ id: '456789012345678901', token: 'webhook-token', type: 1, name: 'Communications Studio Publisher' }]));
    if (url.endsWith('/messages')) return new Response(JSON.stringify({ id: '567890123456789012', mention_roles: [] }));
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    throw new Error('The container must not be sent after a failed role ping');
  };
  try {
    await assert.rejects(publishToDiscord({ document, identity, routing: { ...routing, channel_id } }), { code: 'discord_role_ping_not_recognized' });
    assert.deepEqual(requests.map((request) => request.method), ['GET', 'POST', 'DELETE']);
  } finally {
    globalThis.fetch = originalFetch;
    config.discord.botToken = originalToken;
  }
});

test('a rejected container send removes the preceding bot role ping', async () => {
  const document = documentFixture();
  document._publish_confirmation = 'explicit-user-confirmation';
  document._publish_action = 'publish-now-button';
  const channel_id = '765432109876543210';
  const requests = [];
  const originalFetch = globalThis.fetch;
  const originalToken = config.discord.botToken;
  config.discord.botToken = 'test-bot-token';
  globalThis.fetch = async (url, options = {}) => {
    requests.push(options.method || 'GET');
    if (url.endsWith('/webhooks')) return new Response(JSON.stringify([{ id: '456789012345678901', token: 'webhook-token', type: 1, name: 'Communications Studio Publisher' }]));
    if (url.endsWith('/messages')) return new Response(JSON.stringify({ id: '567890123456789012', mention_roles: routing.allowed_mentions.roles }));
    if (options.method === 'DELETE') return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ message: 'Invalid Form Body' }), { status: 400 });
  };
  try {
    await assert.rejects(publishToDiscord({ document, identity, routing: { ...routing, channel_id } }), { code: 'discord_publish_failed' });
    assert.deepEqual(requests, ['GET', 'POST', 'POST', 'DELETE']);
  } finally {
    globalThis.fetch = originalFetch;
    config.discord.botToken = originalToken;
  }
});
