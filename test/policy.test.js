import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizedIdentities,
  FEC_DISCORD_ROLES,
  NARA_DISCORD_ROLES
} from '../src/policy.js';
import { CHANNEL_ACCESS_ROLES } from '../src/routing.js';

const memberships = (...rows) => rows.map(([groupId, roleName]) => ({
  group: { id: groupId },
  role: { name: roleName }
}));

const ids = (authz) => authorizedIdentities(authz).map((identity) => identity.id);

test('Roblox rank alone cannot authorize an executive publishing identity', () => {
  const allowed = ids({
    discordRoleIds: [],
    robloxUserId: '1',
    robloxGroupRoles: memberships([6071470, 'Attorney General'])
  });
  assert.ok(!allowed.includes('doj'));
});

test('DOJ requires both qualifying Roblox rank and Executive Branch access role', () => {
  const allowed = ids({
    discordRoleIds: [CHANNEL_ACCESS_ROLES.executive],
    robloxUserId: '1',
    robloxGroupRoles: memberships([6071470, 'Attorney General'])
  });
  assert.ok(allowed.includes('doj'));
  assert.ok(!allowed.includes('fbi'));
});

test('FBI Director requires Executive Branch access role', () => {
  assert.ok(!ids({
    discordRoleIds: [],
    robloxUserId: '1',
    robloxGroupRoles: memberships([6057701, 'Director'])
  }).includes('fbi'));

  assert.ok(ids({
    discordRoleIds: [CHANNEL_ACCESS_ROLES.executive],
    robloxUserId: '1',
    robloxGroupRoles: memberships([6057701, 'Director'])
  }).includes('fbi'));
});

test('MPD is independently gated by MPD rank plus Executive Branch access', () => {
  const allowed = ids({
    discordRoleIds: [CHANNEL_ACCESS_ROLES.executive],
    robloxUserId: '1',
    robloxGroupRoles: memberships([6150285, 'Chief of Police'])
  });
  assert.ok(allowed.includes('mpd'));
  assert.ok(!allowed.includes('doj'));
});

test('White House identities require White House access, not Executive Branch access', () => {
  const robloxGroupRoles = memberships([6121205, 'President']);
  assert.ok(!ids({
    discordRoleIds: [CHANNEL_ACCESS_ROLES.executive],
    robloxUserId: '1',
    robloxGroupRoles
  }).includes('white_house'));
  assert.ok(ids({
    discordRoleIds: [CHANNEL_ACCESS_ROLES.white_house],
    robloxUserId: '1',
    robloxGroupRoles
  }).includes('white_house'));
});

test('OVP follows its White House publication channel access role', () => {
  const robloxGroupRoles = memberships([12711997, 'Vice President']);
  assert.ok(!ids({
    discordRoleIds: [CHANNEL_ACCESS_ROLES.executive],
    robloxUserId: '1',
    robloxGroupRoles
  }).includes('ovp'));
  assert.ok(ids({
    discordRoleIds: [CHANNEL_ACCESS_ROLES.white_house],
    robloxUserId: '1',
    robloxGroupRoles
  }).includes('ovp'));
});

test('Congress and Judiciary require their corresponding Discord branch roles', () => {
  assert.ok(ids({
    discordRoleIds: [CHANNEL_ACCESS_ROLES.legislative],
    robloxUserId: '1',
    robloxGroupRoles: memberships([6057804, 'Speaker of the House'])
  }).includes('house'));
  assert.ok(!ids({
    discordRoleIds: [CHANNEL_ACCESS_ROLES.executive],
    robloxUserId: '1',
    robloxGroupRoles: memberships([6057804, 'Speaker of the House'])
  }).includes('house'));

  assert.ok(ids({
    discordRoleIds: [CHANNEL_ACCESS_ROLES.judicial],
    robloxUserId: '1',
    robloxGroupRoles: memberships([6071495, 'Chief Justice'])
  }).includes('supreme_court'));
});

test('FEC and NARA retain their dedicated Discord-role authorization', () => {
  assert.ok(ids({ discordRoleIds: [FEC_DISCORD_ROLES[0]] }).includes('fec'));
  assert.ok(ids({ discordRoleIds: [FEC_DISCORD_ROLES[1]] }).includes('fec'));
  assert.ok(ids({ discordRoleIds: [NARA_DISCORD_ROLES[0]] }).includes('nara'));
});

test('FEC and NARA do not require Roblox linkage', () => {
  assert.deepEqual(ids({ discordRoleIds: [NARA_DISCORD_ROLES[0]] }), ['nara']);
});

test('unqualified user receives no identities', () => {
  assert.deepEqual(ids({ discordRoleIds: [], robloxUserId: '1', robloxGroupRoles: [] }), []);
});
