import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizedIdentities,
  FEC_DISCORD_ROLES,
  NARA_DISCORD_ROLES
} from '../src/policy.js';

const memberships = (...rows) => rows.map(([groupId, roleName]) => ({
  group: { id: groupId },
  role: { name: roleName }
}));

const ids = (authz) => authorizedIdentities(authz).map((identity) => identity.id);

test('DOJ leadership receives DOJ but not FBI automatically', () => {
  const allowed = ids({
    robloxUserId: '1',
    robloxGroupRoles: memberships([6071470, 'Attorney General'])
  });
  assert.ok(allowed.includes('doj'));
  assert.ok(!allowed.includes('fbi'));
});

test('FBI Director receives FBI identity', () => {
  const allowed = ids({
    robloxUserId: '1',
    robloxGroupRoles: memberships([6057701, 'Director'])
  });
  assert.ok(allowed.includes('fbi'));
});

test('MPD is independently gated by MPD rank', () => {
  const allowed = ids({
    robloxUserId: '1',
    robloxGroupRoles: memberships([6150285, 'Chief of Police'])
  });
  assert.ok(allowed.includes('mpd'));
  assert.ok(!allowed.includes('doj'));
});

test('FEC and NARA are controlled by Discord roles', () => {
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
