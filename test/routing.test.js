import test from 'node:test';
import assert from 'node:assert/strict';
import { publicRouting, routingPolicy, validatePublishRouting } from '../src/routing.js';

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

test('White House is restricted to White House channel and ping', () => {
  const route = publicRouting('white_house', config);
  assert.deepEqual(route.channels.map((x) => x.id), ['899467464826556427']);
  assert.deepEqual(route.ping_options.map((x) => x.key), ['white_house']);
  assert.equal(route.allow_everyone, false);
});

test('OVP posts to White House but may use Executive Ping', () => {
  const route = publicRouting('ovp', config);
  assert.deepEqual(route.channels.map((x) => x.id), ['899467464826556427']);
  assert.deepEqual(route.ping_options.map((x) => x.key), ['executive']);
});

test('executive agencies and military publish in executive branch', () => {
  for (const id of ['doj', 'mpd', 'dhs', 'dcfems', 'dod', 'dcng', 'army', 'cia']) {
    const route = publicRouting(id, config);
    assert.deepEqual(route.channels.map((x) => x.id), ['886076674792390707']);
    assert.deepEqual(route.ping_options.map((x) => x.key), ['executive']);
  }
});

test('legislative and judicial identities route to branch feeds', () => {
  assert.deepEqual(routingPolicy('house').channelKeys, ['legislative']);
  assert.deepEqual(routingPolicy('supreme_court').channelKeys, ['judicial']);
});

test('FEC publishes only to its dedicated channel', () => {
  const route = publicRouting('fec', config);
  assert.deepEqual(route.channels.map((x) => x.id), ['1076283102822940713']);
  assert.equal(route.ping_options.length, 4);
  assert.equal(route.allow_everyone, true);

  assert.deepEqual(
    validatePublishRouting('fec', {
      channel_id: config.channels.executive,
      ping_keys: [],
      ping_everyone: false
    }, config),
    { ok: false, error: 'channel_not_authorized' }
  );
});

test('FEC may combine everyone and approved branch ping roles', () => {
  const result = validatePublishRouting('fec', {
    channel_id: config.channels.fec,
    ping_keys: ['white_house', 'judicial'],
    ping_everyone: true
  }, config);

  assert.equal(result.ok, true);
  assert.deepEqual(result.allowed_mentions.parse, ['everyone']);
  assert.deepEqual(result.allowed_mentions.roles, [
    config.pingRoles.white_house,
    config.pingRoles.judicial
  ]);
});

test('NARA may publish to any branch channel and combine branch pings', () => {
  const route = publicRouting('nara', config);
  assert.equal(route.channels.length, 4);
  assert.equal(route.ping_options.length, 4);
  assert.equal(route.allow_everyone, false);

  const result = validatePublishRouting('nara', {
    channel_id: config.channels.legislative,
    ping_keys: ['executive', 'legislative'],
    ping_everyone: false
  }, config);
  assert.equal(result.ok, true);
});

test('NARA can never use everyone', () => {
  assert.deepEqual(
    validatePublishRouting('nara', {
      channel_id: config.channels.executive,
      ping_keys: [],
      ping_everyone: true
    }, config),
    { ok: false, error: 'everyone_not_authorized' }
  );
});

test('normal identities cannot escape their branch routing', () => {
  assert.deepEqual(
    validatePublishRouting('doj', {
      channel_id: config.channels.legislative,
      ping_keys: [],
      ping_everyone: false
    }, config),
    { ok: false, error: 'channel_not_authorized' }
  );

  assert.deepEqual(
    validatePublishRouting('doj', {
      channel_id: config.channels.executive,
      ping_keys: ['judicial'],
      ping_everyone: false
    }, config),
    { ok: false, error: 'ping_not_authorized' }
  );
});
