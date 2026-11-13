const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function harness({ groups = [], options = {}, agents = [] } = {}) {
  options = {search:'',filter:'all',sortBy:'manual',sortDirection:'asc',...options};
  let cursor = 0, tree;
  const states = [], calls = [];
  const settings = {
    status: 'ready', revision: '1',
    values: { projects: { project: { name: 'Original', icon: 'star', color: '#4F86F7' } } },
    async save(values, revision) { calls.push({ values, revision }); this.values = values; this.revision = '2'; return true; },
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const imports = { './folder-add':{FolderAdd:'FolderAdd'}, './web': {isSidebarDragging:()=>false}, './folder-drag': {},
    react: {
      useState(value) { const i = cursor++; if (!(i in states)) states[i] = value; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
      useRef(value) { const i = cursor++; if (!(i in states)) states[i] = { current: value }; return states[i]; },
      useEffect() {},
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Platform: {OS:'web'}, View: 'View', Text: 'Text', Image: 'Image', Modal: 'Modal', ScrollView: 'ScrollView' },
    '@getpaseo/plugin/client': {
      useSettings: () => settings, useAgents: query => { const rows=agents.filter(agent=>(!query.hosts||query.hosts.includes(agent.hostId))&&(!query.where||query.where(agent))); return query.groupBy ? [] : rows; },
      useWorkspaces: () => [{hostId:'local',key:'w',id:'workspace'}],
      useWorkspace: () => ({ project: { key: 'project' }, projectDisplayName: 'Project' }),
    },
    '@getpaseo/plugin/client/ui': { TextInput: 'TextInput' },
    './visuals': { FeedbackPressable: 'Button', Glyph: 'Glyph' },
    './conversation-view': { useConversationView: () => ({ options, foldersForHost: () => groups, unfiledOrder: () => [] }) },
    './image-picker': { pickIconImage: async () => null },
    './context-menu': {}, './drag-and-drop': {}, '../shared/settings': {}, '../shared/model': (()=>{const mod={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync(require.resolve('../shared/model.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);return mod.exports})(),
    '../shared/status': { aggregateStates: () => ({ state: 'idle', hasUpdates: false }) },
    '../shared/conversations': (()=>{const mod={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync(require.resolve('../shared/conversations.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);return mod.exports})(),
  };
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../client/automatic-tree.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'exports', source + '\nexports.ProjectBranch = ProjectBranch;exports.PlacedProject=PlacedProject;')(name => {
    assert.ok(name in imports, name); return imports[name];
  }, mod.exports);
  function render() {
    cursor = 0;
    tree = mod.exports.ProjectBranch({ reference: { hostId: 'local' }, workspaceKeys: new Set(), row() {}, view: { theme: { colors: {} }, layout: { compact: false, platform: 'web' } } });
  }
  function nodes(node = tree, result = []) {
    if (Array.isArray(node)) node.forEach(item => { if (item) nodes(item, result); });
    else if (node && typeof node === 'object') {
      result.push(node);
      if (node.props?.children) nodes(node.props.children, result);
      if (node.props?.editor) nodes(node.props.editor, result);
      if (node.props?.action) nodes(node.props.action, result);
    }
    return result;
  }
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  const find = label => nodes().find(node => node.props?.accessibilityLabel === label);
  const button = label => nodes().find(node => node.type === 'Button' && text(node) === label);
  render();
  const open = () => { find('Customize project ' + settings.values.projects.project.name).props.onPress(); render(); };
  const setName = value => { find('Display name').props.onChangeText(value); render(); };
  const save = () => { button('Save').props.onPress(); render(); };
  return { settings, calls, render, nodes, find, button, open, setName, save, placed(){cursor=0;return mod.exports.PlacedProject({group:groups[0],groups,hostId:'local',view:{},row(){}})}, branch:()=>nodes().find(node=>node.props?.title) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('project appearance saves once and cancel does not write a draft', async () => {
  const h = harness(); h.open(); h.setName('Cancelled'); h.find('Close project settings').props.onPress(); h.render();
  assert.equal(h.calls.length, 0);
  h.open(); assert.equal(h.find('Display name').props.value, 'Original'); h.setName('Saved'); h.save();
  await tick(); h.render(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].revision, '1');
  assert.equal(h.settings.values.projects.project.name, 'Saved');
});

test('project appearance rejects stale revisions without discarding the draft', async () => {
  const h = harness(); h.open(); h.setName('Unsaved draft');
  h.settings.values.projects.project = { name: 'Other client', icon: 'book' }; h.settings.revision = '2'; h.render(); h.save();
  await tick(); h.render(); assert.equal(h.calls.length, 0); assert.equal(h.find('Display name').props.value, 'Unsaved draft');
  assert.ok(h.nodes().some(node => node.props?.accessibilityRole === 'alert' && node.props.children.includes('another client')));
  assert.equal(h.settings.values.projects.project.name, 'Other client');
});

test('project save failure retains inputs and blocks duplicate submissions', async () => {
  const h = harness(); let finish;
  h.settings.save = async values => { h.calls.push(values); return new Promise(resolve => { finish = resolve; }); };
  h.open(); h.setName('Retry'); const submit = h.button('Save'); submit.props.onPress(); submit.props.onPress(); h.render();
  assert.equal(h.calls.length, 1); assert.equal(h.find('Close project settings').props.disabled, true);
  finish(false); await tick(); h.render(); assert.equal(h.find('Display name').props.value, 'Retry');
  assert.ok(h.nodes().some(node => node.props?.accessibilityRole === 'alert'));
  assert.equal(h.button('Save').props.disabled, false);
});

test('invalid project colors do not save and restoring defaults removes the override', async () => {
  const h = harness(); h.open(); h.find('Icon color').props.onChangeText('bad'); h.render(); h.save(); await tick(); h.render();
  assert.equal(h.calls.length, 0); assert.ok(h.nodes().some(node => node.props?.accessibilityRole === 'alert'));
  h.button('Restore default').props.onPress(); await tick(); h.render(); assert.deepEqual(h.settings.values.projects, {});
});

test('placed project obeys workspace and custom-tab filters and retains explicitly added foreign members',()=>{
 const group={id:'p',name:'Project',projectKey:'project',agentIds:[]};
 assert.equal(harness({groups:[group],options:{workspaceKeys:[]}}).placed(),null);
 assert.equal(harness({groups:[group],options:{members:[]}}).placed(),null);
 const foreign={id:'chat',hostId:'remote',workspace:{key:'foreign-workspace'},title:'Review'};
 const h=harness({groups:[{...group,agentIds:['host-agent:["remote","chat"]']}],options:{members:[{hostId:'remote',agentId:'chat'}]},agents:[foreign]});
 const branch=h.placed();assert.ok(branch);assert.equal(branch.props.reference.key,'w');assert.equal(branch.props.workspaceKeys.size,0);
});
