const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, imports) {
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', code)(name => { assert.ok(name in imports, name); return imports[name]; }, mod.exports);
  return mod.exports;
}

test('project tiles use Paseo identity colors for directory projects', () => {
  const { projectTile } = load('../shared/identity.ts', {});
  // Paseo's default sidebar paints D:\AI-Workspace\claude-chats teal (#368080).
  assert.deepEqual(projectTile('srv_BcQstdm9pHAD', 'D:\\AI-Workspace\\claude-chats', 'claude-chats'), { color: '#368080', letter: 'C' });
  assert.equal(projectTile('h', '/x', '  ').letter, '?');
});

function harness(stored = { open: {}, showAll: [], activeTab: null }) {
  let cursor = 0, tree;
  const slots = [], pending = [], saves = [];
  let saveResult = true, reloads = 0;
  const settings = { status: 'ready', revision: '1', values: stored, async save(values, revision) { saves.push({ values, revision }); return saveResult; }, async reload() { reloads++; } };
  const react = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    // Like React: a changed dependency runs the previous cleanup before the effect runs again.
    useEffect(fn, deps) { const i = cursor++; const slot = slots[i]; if (!slot || deps.some((dep, index) => dep !== slot.deps[index])) { const next = { deps, cleanup: undefined }; slots[i] = next; pending.push(() => { slot?.cleanup?.(); next.cleanup = fn(); }); } },
  };
  const mod = load('../client/view-state.tsx', { react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) }, '@getpaseo/plugin/client': { useSettings: () => settings }, '../shared/settings': { viewState: 'view-state' } });
  const render = () => { cursor = 0; tree = mod.ViewStateProvider({ children: null }); pending.splice(0).forEach(fn => fn()); cursor = 0; tree = mod.ViewStateProvider({ children: null }); pending.splice(0).forEach(fn => fn()); return tree.props.value; };
  return { render, saves, failNext() { saveResult = false; }, reloads: () => reloads };
}
const wait = () => new Promise(resolve => setTimeout(resolve, 350));

test('fold state starts from this device and writes back once after changes settle', async () => {
  const h = harness({ open: { 'project:a': false }, showAll: [], activeTab: null });
  let api = h.render();
  assert.equal(api.isOpen('project:a', true), false);
  assert.equal(api.isOpen('project:b', true), true);
  api.setOpen('project:b', false); api = h.render();
  api.setShowAll('project:a', true); api = h.render();
  await wait();
  assert.equal(h.saves.length, 1);
  assert.deepEqual(h.saves[0].values, { open: { 'project:a': false, 'project:b': false }, showAll: ['project:a'], activeTab: null });
});

test('collapse all folds registered branches and restore returns the previous state', () => {
  const h = harness();
  let api = h.render();
  api.register('project:a', true); api.register('project:b', true);
  api.setOpen('project:a', true); api = h.render();
  api.toggleCollapseAll(['folder:h:x']); api = h.render();
  assert.equal(api.collapsed, true);
  assert.deepEqual(['project:a', 'project:b', 'folder:h:x'].map(key => api.isOpen(key, true)), [false, false, false]);
  api.toggleCollapseAll(); api = h.render();
  assert.equal(api.isOpen('project:a', false), true);
  assert.equal(api.isOpen('project:b', true), true);
});

test('a rejected save reloads so the next change writes with a fresh revision', async () => {
  const h = harness();
  h.failNext();
  const api = h.render();
  api.setOpen('recent', false); h.render();
  await wait();
  assert.equal(h.reloads(), 1);
});
