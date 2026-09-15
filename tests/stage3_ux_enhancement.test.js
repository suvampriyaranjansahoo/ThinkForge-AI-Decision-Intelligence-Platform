const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Stage 3 keyboard shortcuts are actually wired up, not just imported', () => {
  const app = fs.readFileSync('frontend/src/app.js', 'utf8');
  const ux = fs.readFileSync('frontend/src/lib/ux.js', 'utf8');
  // Regression guard: earlier builds imported installGlobalShortcuts but never called it,
  // so Cmd/Ctrl+K did not actually work despite the UI implying it did.
  assert.match(app, /installGlobalShortcuts\(\{openCommands/);
  assert.match(ux, /function installGlobalShortcuts/);
  assert.match(ux, /openShortcuts/);
  assert.match(app, /function showShortcuts/);
  assert.match(app, /SHORTCUTS=/);
});

test('Stage 3 async actions use a real busy/disabled state instead of silent waits', () => {
  const app = fs.readFileSync('frontend/src/app.js', 'utf8');
  const ux = fs.readFileSync('frontend/src/lib/ux.js', 'utf8');
  assert.match(ux, /export function withBusy/);
  const busyCalls = (app.match(/withBusy\(/g) || []).length;
  assert.ok(busyCalls >= 6, `expected withBusy to wrap at least 6 async actions, found ${busyCalls}`);
});

test('Stage 3 shell communicates connectivity state for the local-first architecture', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const app = fs.readFileSync('frontend/src/app.js', 'utf8');
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');
  assert.match(html, /id="offlineBanner"/);
  assert.match(app, /updateOfflineBanner/);
  assert.match(app, /addEventListener\('online'/);
  assert.match(app, /addEventListener\('offline'/);
  assert.match(css, /\.offline-banner/);
});

test('Stage 3 loading affordance respects reduced motion', () => {
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');
  assert.match(css, /\.btn\.loading/);
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.btn\.loading::after/);
});
