import test from 'node:test';
import assert from 'node:assert/strict';
import { IDENTITIES, publicIdentity } from '../src/policy.js';
import { IDENTITY_LOGO_FILES, identityLogoUrl } from '../src/identity-logos.js';

test('every publishing identity has an authoritative logo avatar', () => {
  assert.equal(IDENTITIES.length, 40);
  assert.equal(Object.keys(IDENTITY_LOGO_FILES).length, IDENTITIES.length);

  for (const identity of IDENTITIES) {
    const url = identityLogoUrl(identity.id);
    assert.match(url, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:Redirect\/file\//);
    assert.match(url, /\?width=512$/);
    assert.equal(publicIdentity(identity).avatar_url, url, `${identity.id} must expose its mapped logo`);
  }
});
