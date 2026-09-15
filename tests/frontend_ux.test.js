const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Stage 3 shell exposes decision-centric UX primitives', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');
  const app = fs.readFileSync('frontend/src/app.js', 'utf8');
  const commands = fs.readFileSync('frontend/src/lib/commands.js', 'utf8');
  assert.match(html, /id="commandBtn"/);
  assert.match(html, /id="commandWrap"/);
  assert.match(html, /data-view="decisions"/);
  assert.match(css, /\.focus-grid/);
  assert.match(css, /\.journey/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(commands, /Create a new decision/);
  assert.match(commands, /evidence library/);
  assert.match(app, /Meta?data|decision_opened/);
});

test('Stage 3 UX implements trust and recovery interaction primitives', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');
  const app = fs.readFileSync('frontend/src/app.js', 'utf8');
  const ux = fs.readFileSync('frontend/src/lib/ux.js', 'utf8');
  const commands = fs.readFileSync('frontend/src/lib/commands.js', 'utf8');
  assert.match(html, /id="ariaLive"/);
  assert.match(css, /\.ai-state\.working/);
  assert.match(css, /\.ai-state\.error/);
  assert.match(css, /\.toast-undo/);
  assert.match(app, /createFocusTrap/);
  assert.match(app, /undoLast/);
  assert.match(app, /aiState=/);
  assert.match(ux, /createFocusTrap/);
  assert.match(ux, /announce/);
  assert.match(commands, /ArrowDown/);
});

test('agent workspace exposes an approval-gated orchestration surface', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const app = fs.readFileSync('frontend/src/app.js', 'utf8');
  assert.match(html, /data-view="agent"/);
  assert.match(app, /function renderAgent\(/);
  assert.match(app, /Approval required/);
  assert.match(app, /Approve & run/);
});

test('free offline demo mode is explicit and never mislabeled as live AI', () => {
  const app = fs.readFileSync('frontend/src/app.js', 'utf8');
  const guide = fs.readFileSync('docs/FREE_DEMO_MODE.md', 'utf8');
  assert.match(app, /offlineDemo/);
  assert.match(app, /deterministic-demo/);
  assert.match(app, /offlineAgent/);
  assert.match(guide, /no API keys, database, login, or paid provider/i);
});
