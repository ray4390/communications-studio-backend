import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizedIdentities, getIdentity } from '../src/policy.js';
import { CHANNEL_ACCESS_ROLES, publicRouting, routingPolicy } from '../src/routing.js';
import { identityLogoUrl } from '../src/identity-logos.js';

const config = {
  channels: {
    white_house: '899467464826556427',
    executive: '886076674792390707',
    legislative: '886077286414172171',
    judicial: '886077834911678464',
    fec: '1076283102822940713'
  },
  pingRoles: {
    executive: '937155572342587392',
    white_house: '1156347407899041812',
    legislative: '1156346015234924615',
    judicial: '1156346227286360236'
  }
};

const ids = (discordRoleIds = []) => authorizedIdentities({ discordRoleIds }).map((identity) => identity.id);

test('ULPA is a Discord-role-only Judicial publishing identity', () => {
  const identity = getIdentity('ulpa');
  assert.ok(identity);
  assert.equal(identity.displayName, 'Uniform Legal Practice Authority');
  assert.equal(identity.initials, 'ULPA');
  assert.equal(identity.access.type, 'discord');
  assert.deepEqual(identity.access.roles, [CHANNEL_ACCESS_ROLES.judicial]);
});

test('ULPA requires the Judicial Branch access role and no Roblox membership', () => {
  assert.ok(!ids([]).includes('ulpa'));
  assert.ok(!ids([CHANNEL_ACCESS_ROLES.executive]).includes('ulpa'));
  assert.ok(ids([CHANNEL_ACCESS_ROLES.judicial]).includes('ulpa'));
});

test('ULPA can publish only to the Judicial Branch channel with Judicial Ping available', () => {
  assert.deepEqual(routingPolicy('ulpa').channelKeys, ['judicial']);
  const route = publicRouting('ulpa', config, [CHANNEL_ACCESS_ROLES.judicial]);
  assert.deepEqual(route.channels.map((channel) => channel.id), [config.channels.judicial]);
  assert.deepEqual(route.ping_options.map((ping) => ping.key), ['judicial']);
  assert.equal(route.allow_everyone, false);
});

test('ULPA uses the uploaded vendored seal as its authoritative avatar', () => {
  assert.equal(
    identityLogoUrl('ulpa'),
    'https://raw.githubusercontent.com/nationalarchivesusar/communications-studio/main/assets/identity-logos/ulpa.png'
  );
});
