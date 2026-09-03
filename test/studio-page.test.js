import assert from 'node:assert/strict';
import test from 'node:test';
import { renderStudioPage, studioContentSecurityPolicy } from '../src/studio-page.js';

test('same-origin Studio shell loads the existing frontend assets', () => {
  const html = renderStudioPage();
  assert.match(html, /<base href="https:\/\/nationalarchivesusar\.github\.io\/communications-studio\/"/);
  assert.match(html, /<div id="app"/);
  assert.match(html, /src="\.\/config\.js"/);
  assert.match(html, /src="\.\/auth-ui\.js/);
  assert.match(html, /src="\.\/app-13\.js/);
  assert.doesNotMatch(html, /<script>(?!\s*<\/script>)/);
});

test('Studio CSP keeps API calls same-origin while allowing versioned frontend assets', () => {
  const csp = studioContentSecurityPolicy();
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /script-src 'self' https:\/\/nationalarchivesusar\.github\.io/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
});
