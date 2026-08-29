import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVICE_NAME, publicServiceStatus } from '../src/status.js';

test('public root status identifies the healthy backend without exposing configuration', () => {
  assert.deepEqual(publicServiceStatus({
    guildId: '886068973886640129',
    warnings: []
  }), {
    ok: true,
    service: SERVICE_NAME,
    guild_id: '886068973886640129',
    config_warnings: []
  });
});
