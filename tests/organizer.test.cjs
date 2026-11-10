const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');

// Exercise the actual component's rendered tree and press handlers without a native host.
// This does not replace screenshot, native gesture, or real-device acceptance.
function harness() {
  let cursor = 0, states = [], tree;
  const agents = [
    { id: 'one', title: '麻烦你帮我看一下这个', status: 'idle', cwd: '/project', lastActivityAt: new Date().toISOString() },
    { id: 'two', title: '203', status: 'idle', cwd: '/project', lastActivityAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'three', title: '未归类对话', status: 'running', cwd: '/project' },
  ];
  const settings = { status: 'ready', values: { mode: 'folders', groups: [{ id: 'work', name: '203', agentIds: ['one', 'two'] }], ungroupedOrder: [] }, revision: '1', saving: false, saveError: null,
    async save(values) { this.values = values; return true; }, async reload() {} };
  const jsx = (type, props, key) => {
    if (type === 'SidebarRow') props = { ...props,
      accessibilityLabel: props.id.startsWith('folder-') ? `${props.label}，2 个对话` : `打开对话 ${props.label}`,
      accessibilityState: { expanded: props.icon !== 'ChevronRight' },
      children: props.trailing,
    };
    return { type, props: props || {}, key };
  };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef(value) { const i = cursor++; if (!(i in states)) states[i] = { current: value }; return states[i]; },
  };
  const modelModule = { exports: {} };
  function compile(path) { return ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText; }
  new Function('exports', compile('../shared/model.ts'))(modelModule.exports);
  const mocks = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ScrollView: 'ScrollView', PanResponder: { create: () => ({ panHandlers: {} }) } },
    '@getpaseo/plugin/client': { useSettings: () => settings },
    '@getpaseo/plugin/client/ui': { SidebarRow: 'SidebarRow', Icon: 'Icon' },
    '../shared/settings': { organization: {} },
    '../shared/model': modelModule.exports,
    './use-agents': { useConversations: () => ({ agents, loading: false, error: null }) },
  };
  const component = { exports: {} };
  new Function('require', 'exports', compile('../client/organizer.tsx'))(name => { assert.ok(name in mocks, `Unexpected import: ${name}`); return mocks[name]; }, component.exports);
  const colors = Object.fromEntries(['surface0', 'surface1', 'surface2', 'foreground', 'foregroundMuted', 'accent', 'border', 'statusSuccess', 'statusDanger'].map(k => [k, `token-${k}`]));
  let compact = false;
  function render() { cursor = 0; tree = component.exports.Organizer({ theme: { colors }, layout: { compact, platform: 'web' }, host: { id: 'test', label: 'test' }, sidebar: true, onOpen() {} }); return tree; }
  function walk(node, result = []) { if (Array.isArray(node)) node.forEach(n => walk(n, result)); else if (node && typeof node === 'object') { result.push(node); walk(node.props?.children, result); } return result; }
  function all() { return walk(tree); }
  function find(label) { return all().find(node => node.props.accessibilityLabel === label); }
  function press(label) { const node = find(label); assert.ok(node, `Missing control: ${label}`); node.props.onPress(); render(); }
  render();
  return { render, find, press, all, settings, compact() { compact = true; render(); } };
}

test('sidebar folders default to collapsed; ungrouped list is hidden', () => {
  const h = harness(); assert.equal(h.find('203，2 个对话').props.accessibilityState.expanded, false);
  assert.equal(h.find('打开对话 麻烦你帮我看一下这个'), undefined);
  assert.equal(h.find('未分组对话'), undefined);
  assert.equal(h.find('搜索对话'), undefined);
});
test('folder row expands and collapses its conversations', () => {
  const h = harness(); h.press('203，2 个对话');
  assert.ok(h.find('打开对话 麻烦你帮我看一下这个')); assert.ok(h.find('打开对话 203'));
  h.press('203，2 个对话'); assert.equal(h.find('打开对话 203'), undefined);
});
test('plus opens conversation picker without toggling the folder', () => {
  const h = harness(); h.press('添加对话到 203'); assert.ok(h.find('添加 未归类对话'));
  assert.equal(h.find('203，2 个对话').props.accessibilityState.expanded, false);
});
test('adding a conversation saves membership and opens the folder', async () => {
  const h = harness(); h.press('添加对话到 203'); h.press('添加 未归类对话');
  await new Promise(resolve => setImmediate(resolve)); h.render();
  assert.deepEqual(h.settings.values.groups[0].agentIds, ['one', 'two', 'three']);
  assert.ok(h.find('打开对话 未归类对话'));
});
test('ellipsis opens actions; editing controls stay hidden otherwise', () => {
  const h = harness(); assert.equal(h.find('重命名'), undefined); h.press('203 的菜单');
  assert.ok(h.find('重命名')); assert.ok(h.find('删除文件夹')); assert.ok(h.find('拖拽整理'));
});
test('delete folder preserves conversations and does not call an agent delete API', async () => {
  const h = harness(); h.press('203 的菜单'); h.press('删除文件夹');
  await new Promise(resolve => setImmediate(resolve)); h.render();
  assert.deepEqual(h.settings.values.groups, []); assert.deepEqual(h.settings.values.ungroupedOrder, ['one', 'two']);
});
test('organizing tools expose collapsed ungrouped and mode switch', async () => {
  const h = harness(); h.press('整理文件夹'); assert.ok(h.find('未分组对话'));
  h.press('模式：折叠列表'); await new Promise(resolve => setImmediate(resolve)); h.render();
  assert.equal(h.settings.values.mode, 'dividers'); assert.ok(h.find('打开对话 203'));
});
test('compact sidebar uses host-owned native rows', () => {
  const h = harness(); h.compact(); h.press('203，2 个对话');
  assert.equal(h.find('打开对话 203').type, 'SidebarRow');
});
