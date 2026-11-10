const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { z } = require('zod');
function harness(saved) {
  let tree, cursor = 0, states = [], view = saved ?? { density: 'compact', folder: 'all', scope: 'workspace' }, opened;
  const agents = [{ id: 'one', workspaceId: 'current', title: '当前工作区的长标题', status: 'idle', cwd: '/project' }, { id: 'two', workspaceId: 'other', title: '另一个工作区', status: 'running', cwd: '/other' }];
  const settings = { status: 'ready', values: { mode: 'folders', groups: [{ id: 'work', name: '工作', agentIds: ['one'] }], ungroupedOrder: [] }, saving: false, revision: '1', async save(v) { this.values = v; return true; } };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const react = { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], v => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; }, useRef(value) { const i = cursor++; if (!(i in states)) states[i] = { current: value }; return states[i]; }, useEffect() {} };
  const imports = { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, zod: { z },
    '@getpaseo/plugin/client': { useSettings: () => settings, useWorkspace: () => ({ title: '当前项目' }), useTabState: () => [view, next => { view = next; }] },
    '@getpaseo/plugin/client/ui': { Icon: 'Icon' },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput: 'TextInput', Animated: {}, AccessibilityInfo: {} },
    '../shared/settings': { organization: {} }, '../shared/model': { moveAgent: (s, id, groupId) => ({ ...s, groups: s.groups.map(g => ({ ...g, agentIds: [...g.agentIds.filter(x => x !== id), ...(g.id === groupId ? [id] : [])] })) }) }, './organizer': { Organizer: 'Organizer' }, './use-agents': { useConversations: () => ({ agents, loading: false, error: null }) } };
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../client/conversation-panel.tsx'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} }; new Function('require', 'exports', code)(name => { assert.ok(name in imports, name); return imports[name]; }, mod.exports);
  const colors = Object.fromEntries(['surface0', 'surface1', 'surface2', 'foreground', 'foregroundMuted', 'accent', 'border', 'statusSuccess', 'statusDanger'].map(k => [k, k]));
  function render() { cursor = 0; tree = mod.exports.ConversationPanel({ theme: { colors }, layout: { compact: false }, host: { id: 'host' }, workspaceId: 'current', navigation: { openAgent(input) { opened = input; } }, tab: {} }); }
  function walk(node, out = []) { if (Array.isArray(node)) node.forEach(n => walk(n, out)); else if (node && typeof node === 'object') { out.push(node); walk(node.props.children, out); } return out; }
  function find(label) { return walk(tree).find(n => n.props.accessibilityLabel === label); }
  function press(label) { const node = find(label); assert.ok(node, label); node.props.onPress(); render(); }
  render(); return { render, find, press, nodes: () => walk(tree), settings, view: () => view, opened: () => opened };
}
test('panel defaults to current workspace and no other conversations', () => { const h = harness(); assert.ok(h.find('打开 当前工作区的长标题')); assert.equal(h.find('打开 另一个工作区'), undefined); });
test('host scope is explicit and exposes other workspaces', () => { const h = harness(); h.press('当前主机全部对话'); assert.ok(h.find('打开 另一个工作区')); assert.equal(h.view().scope, 'host'); });
test('compact to multiline is persisted and changes text line limits', () => { const h = harness(); assert.ok(h.nodes().some(n => n.type === 'Text' && n.props.children === '当前工作区的长标题' && n.props.numberOfLines === 1)); h.press('多行'); assert.equal(h.view().density, 'detailed'); assert.ok(h.nodes().some(n => n.type === 'Text' && n.props.children === '当前工作区的长标题' && n.props.numberOfLines === 3)); });
test('folder tab filters and preserves selection', () => { const h = harness(); h.press('文件夹 未分组'); assert.equal(h.find('打开 当前工作区的长标题'), undefined); assert.equal(h.view().folder, 'ungrouped'); });
test('open routes agent to current host', () => { const h = harness(); h.press('打开 当前工作区的长标题'); assert.deepEqual(h.opened(), { agentId: 'one', serverId: 'host' }); });
test('stale restored folder gracefully falls back to all', () => { const h = harness({ density: 'compact', folder: 'removed', scope: 'workspace' }); assert.ok(h.find('打开 当前工作区的长标题')); });
test('organize is an explicit separate mode and can return', () => { const h = harness(); h.press('整理'); assert.ok(h.nodes().some(n => n.type === 'Organizer')); h.press('返回对话列表'); assert.ok(h.find('精简')); });
