import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscordPublishPayload, validatePublishDocument } from '../src/publish.js';

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
    robloxUsername: 'RobloxTestUser'
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
});
