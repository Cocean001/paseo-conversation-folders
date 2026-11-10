const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
function harness() {
  let cursor = 0, states = [], tree, effects = [], query;
  const owner = { status: 'ready', values: { mode: 'folders', groups: [{ id: 'local-folder', name: '原有分组', agentIds: [] }], ungroupedOrder: [] }, revision: '1', async save(next) { this.values = next; return true; } };
  const extra = { status: 'ready', values: { hosts: {} }, revision: '1', async save(next) { this.values = next; return true; } };
  const readHost = async () => ({ hostId: 'local' });
  const jsx = (type, props) => ({ type, props: props || {} });
  const react = { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; }, useRef(value) { const i = cursor++; if (!(i in states)) states[i] = { current: value }; return states[i]; }, useEffect(fn) { const i = cursor++; if (!(i in states)) { states[i] = true; effects.push(fn); } } };
  const imports = { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView: 'ScrollView', Pressable: 'Pressable' }, '@getpaseo/plugin/client/ui': { Icon: 'Icon' }, '@getpaseo/plugin/client': { useSettings: d => d === 'owner' ? owner : extra, useRpc: () => readHost, useHosts: () => [{ serverId: 'local', label: '本机', status: 'online' }, { serverId: 'remote', label: '远端', status: 'online' }], useAgents: q => { query = q; return []; }, useAgent: () => null }, '../shared/settings': { organization: 'owner', hostOrganizations: 'extra' }, '../shared/host-context': { hostContext: {} }, '../shared/model': (() => { const mod = { exports: {} }; const source = ts.transpileModule(fs.readFileSync(require.resolve('../shared/model.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText; new Function('exports', source)(mod.exports); return mod.exports; })() };
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../client/sidebar.tsx'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} }; new Function('require', 'exports', code)(name => { assert.ok(name in imports, name); return imports[name]; }, mod.exports);
  function render() { cursor = 0; tree = mod.exports.FolderSidebar({ theme: { colors: {} }, layout: { compact: false }, active: { agent: null, workspace: null }, navigation: {} }); }
  function walk(node, out = []) { if (Array.isArray(node)) node.forEach(n => walk(n, out)); else if (node && typeof node === 'object') { out.push(node); walk(node.props.children, out); } return out; }
  function find(label) { return walk(tree).find(n => n.props.accessibilityLabel === label); }
  function press(label) { assert.ok(find(label), label); find(label).props.onPress(); render(); }
  render(); for (const fn of effects) fn();
  return { render, find, press, owner, extra, query: () => query };
}
test('multiple configured hosts no longer block sidebar; original groups preserved', async () => { const h = harness(); await new Promise(r => setImmediate(r)); h.render(); assert.ok(h.find('Folder 原有分组')); assert.deepEqual(h.query().hosts, ['local']); assert.ok(h.find('Select host 远端')); });
test('switch hosts isolates queries and folder writes; returning restores local groups', async () => { const h = harness(); await new Promise(r => setImmediate(r)); h.render(); h.press('Select host 远端'); assert.deepEqual(h.query().hosts, ['remote']); assert.equal(h.find('Folder 原有分组'), undefined); h.press('New folder'); h.find('Folder name').props.onChangeText('远端分组'); h.render(); h.press('Create'); await new Promise(r => setImmediate(r)); h.render(); assert.equal(h.extra.values.hosts.remote.groups[0].name, '远端分组'); assert.equal(h.owner.values.groups[0].name, '原有分组'); h.press('Select host 本机'); assert.ok(h.find('Folder 原有分组')); assert.equal(h.find('Folder 远端分组'), undefined); });
test('folder menu supports rename and safe deletion while preserving host separation', async () => {
 const h = harness(); await new Promise(r => setImmediate(r)); h.render(); h.press('⋮'); h.press('Rename'); h.find('Folder name').props.onChangeText('改名后'); h.render(); h.press('Save'); await new Promise(r => setImmediate(r)); h.render(); assert.ok(h.find('Folder 改名后')); h.press('⋮'); h.press('Delete folder'); await new Promise(r => setImmediate(r)); h.render(); assert.equal(h.owner.values.groups.length, 0); assert.deepEqual(h.extra.values.hosts, {});
});
test('compact and multiline switch stays within plugin view', async () => { const h = harness(); await new Promise(r => setImmediate(r)); h.render(); h.press('Compact'); assert.ok(h.find('Comfortable')); h.press('Comfortable'); assert.ok(h.find('Compact')); });
