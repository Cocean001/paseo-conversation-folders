const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const jsx = (type, props) => ({ type, props });
const react = { createContext: () => ({}), useContext: () => null, useRef: value => ({ current: value }), useState: value => [value, () => {}], useEffect() {} };
const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(require.resolve('../client/touch-drag.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
new Function('require', 'exports', code)(name => ({ './steady': { useSteadyControl: () => null }, react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', Platform: { OS: 'ios' } } })[name], mod.exports);
const { underFinger, edgeSpeed, createEngine } = mod.exports;
const tick = () => new Promise(resolve => setImmediate(resolve));
const node = (top, height) => ({ current: { measure: callback => callback(0, 0, 300, height, 0, top) } });

function setup() {
  const ghosts = [], locks = [], shown = [], commits = [];
  const engine = createEngine(node(0, 800), ghost => ghosts.push(ghost));
  const target = (name, top, height, accepts = () => true) => {
    engine.register({ node: node(top, height), show: position => shown.push([name, position]), resolve: (source, y) => accepts(source) ? { position: y < top + height / 2 ? 'before' : 'after', commit: async () => commits.push([name, source.kind]) } : null });
  };
  engine.attachScroll({ node: { current: { scrollTo() {} } }, metrics: { current: { offset: 0, content: 2000 } }, setLocked: locked => locks.push(locked) });
  return { engine, target, ghosts, locks, shown, commits };
}

test('targets under the finger come innermost first and collapsed ones never match', () => {
  const entries = [{ id: 'branch', rect: { top: 0, height: 400 } }, { id: 'row', rect: { top: 100, height: 40 } }, { id: 'hidden', rect: { top: 100, height: 0 } }];
  assert.deepEqual(underFinger(entries, 120).map(entry => entry.id), ['row', 'branch']);
  assert.deepEqual(underFinger(entries, 300).map(entry => entry.id), ['branch']);
});

test('auto-scroll runs only in the edge bands, toward the nearer edge, and is capped', () => {
  const viewport = { top: 100, height: 600 };
  assert.equal(edgeSpeed(400, viewport), 0);
  assert.ok(edgeSpeed(110, viewport) < 0);
  assert.ok(edgeSpeed(690, viewport) > 0);
  assert.equal(edgeSpeed(-500, viewport), -8);
  assert.ok(Math.abs(edgeSpeed(140, viewport)) < Math.abs(edgeSpeed(105, viewport)));
});

test('a long press released in place opens the row menu and moves nothing', async () => {
  const h = setup(); let menus = 0;
  h.target('row', 100, 40);
  h.engine.touchStart(120); h.engine.lift({ kind: 'conversation', value: { hostId: 'h', agentId: 'a' } }, 'Chat', () => menus++);
  h.engine.touchMove(124); h.engine.touchEnd(); await tick();
  assert.equal(menus, 1); assert.deepEqual(h.commits, []); assert.deepEqual(h.locks, [true, false]);
});

test('dragging drops on the innermost accepting target and clears its marker', async () => {
  const h = setup(); let menus = 0;
  h.target('project', 0, 400, source => source.kind === 'folder');
  h.target('conversation', 200, 40, source => source.kind === 'conversation');
  h.engine.touchStart(50); h.engine.lift({ kind: 'folder', value: { hostId: 'h', groupId: 'p' } }, 'Project', () => menus++);
  h.engine.touchMove(80); await tick();
  h.engine.touchMove(230); await tick();
  h.engine.touchEnd(); await tick();
  assert.equal(menus, 0);
  assert.deepEqual(h.commits, [['project', 'folder']]);
  assert.deepEqual(h.shown.at(-1), ['project', null]);
  assert.equal(h.ghosts.at(-1), null);
});

test('a cancelled touch neither drops nor opens the menu, and unlocks scrolling', async () => {
  const h = setup(); let menus = 0;
  h.target('row', 100, 40);
  h.engine.touchStart(120); h.engine.lift({ kind: 'conversation', value: { hostId: 'h', agentId: 'a' } }, 'Chat', () => menus++);
  h.engine.touchMove(200); await tick(); h.engine.cancel(); h.engine.touchEnd(); await tick();
  assert.equal(menus, 0); assert.deepEqual(h.commits, []); assert.equal(h.locks.at(-1), false);
});
