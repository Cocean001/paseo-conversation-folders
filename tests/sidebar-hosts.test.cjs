const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
function harness(snapshots = []) {
  let cursor = 0, states = [], tree, effects = [], query;
  const owner = { status: 'ready', values: { mode: 'folders', groups: [{ id: 'local-folder', name: '原有分组', agentIds: [] }], ungroupedOrder: [] }, revision: '1', async save(next) { this.values = next; return true; } };
  const extra = { status: 'ready', values: { hosts: {} }, revision: '1', async save(next) { this.values = next; return true; } };
  const prefs = { status: 'ready', values: { grouping: 'manual', showServer: false, showTabs: true, tabStyle: 'full', showCounts: true, multilineTitles: false }, revision: '1', async save(next) { this.values = next; return true; } };
  const readHost = async () => ({ hostId: 'local' });
  const jsx = (type, props) => ({ type, props: props || {} });
  const react = { useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; }, useRef(value) { const i = cursor++; if (!(i in states)) states[i] = { current: value }; return states[i]; }, useEffect(fn) { const i = cursor++; if (!(i in states)) { states[i] = true; effects.push(fn); } } };
  const sharedModule = { exports: {} }; new Function('exports', ts.transpileModule(fs.readFileSync(require.resolve('../shared/conversations.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(sharedModule.exports);
  const imports = { '../shared/folder-picker': (()=>{const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(require.resolve('../shared/folder-picker.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;new Function('exports','require',code)(m.exports,()=>{const model={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync(require.resolve('../shared/model.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(model.exports);return model.exports;});return m.exports;})(), './folder-add':{FolderAdd:'FolderAdd'}, './folder-drag': {FolderDragProvider:'FolderDragProvider',DragFolderRow:'DragFolderRow',FolderDropTarget:'FolderDropTarget'}, './conversation-view':{ConversationViewContext:{Provider:'Provider'}}, './sidebar-tabs':{SidebarTabsView:'SidebarTabsView'}, './conversation-actions': {ConversationActions:'ConversationActions'}, '../shared/status': {conversationState:()=> 'idle',aggregateStates:()=>({state:'idle',hasUpdates:false})}, '../shared/activity': { activityTime: () => 'now' }, '../shared/conversations': sharedModule.exports, './drag-and-drop': { ConversationDragProvider: 'ConversationDragProvider', ConversationDropTarget: 'ConversationDropTarget', DragConversationRow: 'DragConversationRow' }, './dropdown-menu': { DropdownMenu: 'DropdownMenu' }, './visuals': { loadingEffects: ['spinner','orbit','pulse','dots','bars'].map(id=>({id,label:id})), LoadingMark:'LoadingMark', FeedbackPressable: 'Pressable', Glyph: 'Glyph', StatusMark: 'StatusMark', EntryReveal: 'EntryReveal', Reveal: 'Reveal', Disclosure: 'Disclosure', Transition: 'Transition' }, './automatic-tree': { AutomaticTree: 'AutomaticTree', ProjectFolder:'ProjectFolder' }, react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView: 'ScrollView', Pressable: 'Pressable' }, '@getpaseo/plugin/client/ui': { Icon: 'Icon', Modal: Object.assign(() => {}, { Content: 'ModalContent' }), SettingsSection: 'SettingsSection', SettingsSelect: 'SettingsSelect', SettingsSwitch: 'SettingsSwitch', SettingsAction: 'SettingsAction' }, '@getpaseo/plugin/client': { useSettings: d => d === 'preferences' ? prefs : d === 'owner' ? owner : extra, useRpc: () => readHost, useHosts: () => [{ serverId: 'local', label: '本机', status: 'online' }, { serverId: 'remote', label: '远端', status: 'online' }], useAgents: q => { if (q?.hosts) query = q; const rows=snapshots.filter(agent=>(!q?.hosts||q.hosts.includes(agent.hostId))&&(!q?.where||q.where(agent))); if(q?.groupBy){const buckets=new Map();for(const agent of rows){const key=q.groupBy(agent);if(!buckets.has(key))buckets.set(key,{key,items:[]});buckets.get(key).items.push(agent)}return [...buckets.values()]}return rows.map(agent=>({kind:'agent',hostId:agent.hostId,id:agent.id,key:agent.hostId+':'+agent.id})); }, useWorkspaces: q => { const rows = [{ ref: {key:'w-local',hostId:'local'}, project:{key:'p-local'},projectDisplayName:'Local project',labels:['work'],background:false },{ref:{key:'w-remote',hostId:'remote'},project:{key:'p-remote'},projectDisplayName:'Remote project',labels:['personal'],background:true}].filter(row => !q?.where || q.where(row)); if(!q?.groupBy)return rows.map(row=>row.ref); const groups=new Map(); for(const row of rows){const keys=q.groupBy(row); for(const key of Array.isArray(keys)?keys:[keys]){const id=typeof key==='string'?key:key.key; if(!groups.has(id))groups.set(id,{key:id,title:typeof key==='string'?key:key.title,items:[]});groups.get(id).items.push(row.ref)}} return [...groups.values()]; }, useAgent: () => null }, '../shared/settings': { organization: 'owner', hostOrganizations: 'extra', displayPreferences: 'preferences' }, '../shared/host-context': { hostContext: {} }, '../shared/model': (() => { const mod = { exports: {} }; const source = ts.transpileModule(fs.readFileSync(require.resolve('../shared/model.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText; new Function('exports', source)(mod.exports); return mod.exports; })() };
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../client/sidebar.tsx'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} }; new Function('require', 'exports', 'setInterval', code)(name => { assert.ok(name in imports, name); return imports[name]; }, mod.exports, () => 0);
  function render() { cursor = 0; tree = mod.exports.FolderSidebar({ theme: { colors: {} }, layout: { compact: false }, active: { agent: null, workspace: null }, navigation: {} }); }
  function walk(node, out = []) { if (Array.isArray(node)) node.forEach(n => walk(n, out)); else if (node && typeof node === 'object') { out.push(node); walk(node.props.children, out); if (node.type === 'DropdownMenu') walk(node.props.header, out); } return out; }
  function find(label) { return walk(tree).find(n => n.props.accessibilityLabel === label); }
  function press(label) { assert.ok(find(label), label); find(label).props.onPress(); render(); }
  render(); for (const fn of effects) fn();
  return { render, find, press, owner, extra, prefs, nodes: () => walk(tree), query: () => query };
}
test('multiple configured hosts no longer block sidebar; original groups preserved', async () => { const h = harness(); await new Promise(r => setImmediate(r)); h.render(); assert.ok(h.find('Folder 原有分组')); assert.deepEqual(h.query().hosts, ['local']); assert.ok(h.find('Select host 远端')); });
test('switch hosts isolates queries and folder writes; returning restores local groups', async () => { const h = harness(); await new Promise(r => setImmediate(r)); h.render(); h.press('Select host 远端'); assert.deepEqual(h.query().hosts, ['remote']); assert.equal(h.find('Folder 原有分组'), undefined); h.press('New folder'); h.find('Folder name').props.onChangeText('远端分组'); h.render(); h.press('Create'); await new Promise(r => setImmediate(r)); h.render(); assert.equal(h.extra.values.hosts.remote.groups[0].name, '远端分组'); assert.equal(h.owner.values.groups[0].name, '原有分组'); h.press('Select host 本机'); assert.ok(h.find('Folder 原有分组')); assert.equal(h.find('Folder 远端分组'), undefined); });
test('folder menu supports rename and safe deletion while preserving host separation', async () => {
 const h = harness(); await new Promise(r => setImmediate(r)); h.render(); h.press('⋮'); h.press('Rename'); h.find('Folder name').props.onChangeText('改名后'); h.render(); h.press('Save'); await new Promise(r => setImmediate(r)); h.render(); assert.ok(h.find('Folder 改名后')); h.press('⋮'); h.press('Delete folder'); await new Promise(r => setImmediate(r)); h.render(); assert.equal(h.owner.values.groups.length, 0); assert.deepEqual(h.extra.values.hosts, {});
});
test('dropdown settings persist multiline preference without opening a settings modal', async () => {
 const h = harness(); await new Promise(r => setImmediate(r)); h.render();
 const dropdown = h.nodes().find(n => n.type === 'DropdownMenu');
 const titles = dropdown.props.items.find(item => item.id === 'titles');
 assert.equal(titles.value, 'Single line'); titles.items.find(item => item.id === 'multiline').onSelect();
 await new Promise(r => setImmediate(r)); h.render();
 assert.equal(h.nodes().find(n => n.type === 'DropdownMenu').props.items.find(item => item.id === 'titles').value, 'Multiline');
 assert.ok(!h.nodes().some(n => n.type === 'Modal'));
});
test('subfolders can only be created below a root folder', async () => {
 const h = harness(); await new Promise(r => setImmediate(r)); h.render(); h.press('⋮'); h.press('New subfolder'); h.find('Folder name').props.onChangeText('Child'); h.render(); h.press('Create'); await new Promise(r => setImmediate(r)); h.render();
 assert.equal(h.owner.values.groups[1].parentId, 'local-folder');
 h.press('Folder 原有分组'); assert.ok(h.find('Folder Child'));
});

test('automatic host plus saves arbitrary names to host-isolated folders without changing grouping', async () => {
 const h = harness(); await new Promise(r=>setImmediate(r)); h.prefs.values.grouping='server-project'; h.render();
 const tree=h.nodes().find(n=>n.type==='AutomaticTree'); assert.ok(tree);
 assert.equal(await tree.props.createFolder('remote','123123'),true); h.render();
 assert.equal(h.extra.values.hosts.remote.groups[0].name,'123123');
 assert.equal(h.owner.values.groups.length,1);
 assert.equal(h.prefs.values.grouping,'server-project');
 assert.equal(h.nodes().find(n=>n.type==='AutomaticTree').props.foldersForHost('remote')[0].name,'123123');
});

test('root folder entry disables blank submit, preserves draft on failure and saves at top level', async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.prefs.values.grouping='server-project';h.render();h.press('New folder');
 assert.equal(h.find('Create').props.disabled,true);assert.ok(h.find('Cancel'));
 const original=h.owner.save;h.owner.save=async()=>false;
 h.find('Folder name').props.onChangeText('Root entry');h.render();h.press('Create');await new Promise(r=>setImmediate(r));h.render();
 assert.equal(h.find('Folder name').props.value,'Root entry');assert.ok(h.nodes().some(n=>n.props.accessibilityRole==='alert'));
 h.owner.save=original;h.press('Create');await new Promise(r=>setImmediate(r));h.render();
 assert.ok(h.owner.values.groups.some(g=>g.name==='Root entry'&&g.topLevel===true&&!g.parentId));assert.ok(h.find('New folder'));
});

test('view dropdown grouping and display options persist, host filter applies without server tabs',async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.render();
 const dropdown=()=>h.nodes().find(n=>n.type==='DropdownMenu');
 dropdown().props.items.find(i=>i.id==='grouping').items.find(i=>i.id==='server-project').onSelect();await new Promise(r=>setImmediate(r));h.render();assert.equal(h.prefs.values.grouping,'server-project');
 dropdown().props.items.find(i=>i.id==='display').items.find(i=>i.id==='tabs').onSelect();await new Promise(r=>setImmediate(r));h.render();assert.equal(h.prefs.values.showTabs,false);
 dropdown().props.items.find(i=>i.id==='hosts').items.find(i=>i.id==='remote').onSelect();h.render();assert.deepEqual(h.nodes().find(n=>n.type==='AutomaticTree').props.hosts.map(host=>host.serverId),['remote']);
 assert.equal(dropdown().props.items.find(i=>i.id==='hosts').value,'远端');
});

test('sorting/filter menus persist and grouping choices include icons',async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.render();const items=()=>h.nodes().find(n=>n.type==='DropdownMenu').props.items;
 assert.ok(items().find(i=>i.id==='grouping').items.every(i=>i.icon));
 items().find(i=>i.id==='sort').items.find(i=>i.id==='created').onSelect();await new Promise(r=>setImmediate(r));h.render();assert.equal(h.prefs.values.sortBy,'created');
 items().find(i=>i.id==='filter').items.find(i=>i.id==='running').onSelect();await new Promise(r=>setImmediate(r));h.render();assert.equal(h.prefs.values.filter,'running');
 h.find('Filter conversations').props.onChangeText('release');h.render();assert.equal(h.query().where({title:'release checklist',status:'running'}),true);assert.equal(h.query().where({title:'other',status:'running'}),false);
});
test('cross-host moves save qualified membership and preserve original host data',async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.render();const move=()=>h.nodes().find(n=>n.type==='ConversationDragProvider').props.move;
 assert.equal(await move()({hostId:'remote',agentId:'chat'},{hostId:'local',groupId:'local-folder'}),true);h.render();
 assert.deepEqual(h.owner.values.assignments,[{hostId:'remote',agentId:'chat',folderHostId:'local',groupId:'local-folder'}]);
 const tree=()=>{h.prefs.values.grouping='server-project';h.render();return h.nodes().find(n=>n.type==='AutomaticTree')};
 assert.deepEqual(tree().props.foldersForHost('local')[0].agentIds,['host-agent:["remote","chat"]']);
 assert.equal(await move()({hostId:'local',agentId:'chat'},{hostId:'local',groupId:'local-folder',beforeId:'chat',beforeHostId:'remote'}),true);h.render();assert.deepEqual(tree().props.foldersForHost('local')[0].agentIds,['chat','host-agent:["remote","chat"]']);assert.equal(h.prefs.values.sortBy,'manual');
 h.owner.save=async()=>false;assert.equal(await move()({hostId:'remote',agentId:'chat'},{hostId:'local',groupId:null}),false);h.render();assert.equal(h.owner.values.assignments.length,2);assert.ok(h.nodes().some(n=>n.props.accessibilityRole==='alert'));
});

test('failed custom-order preference reports partial success without losing saved move',async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.render();h.prefs.save=async()=>false;
 const move=h.nodes().find(n=>n.type==='ConversationDragProvider').props.move;
 assert.equal(await move({hostId:'local',agentId:'a'},{hostId:'local',groupId:'local-folder',beforeId:'b'}),true);h.render();assert.equal(h.owner.values.assignments[0].agentId,'a');assert.ok(h.nodes().some(n=>n.props.accessibilityRole==='alert'&&String(n.props.children).includes('custom order could not be enabled')));
});


test('top Filter contains original menu features and search is confined to dropdown header',async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.render();assert.ok(h.find('Filter'));
 const menu=h.nodes().find(n=>n.type==='DropdownMenu');assert.deepEqual(menu.props.items.slice(0,8).map(i=>i.id),['grouping','sort','titles','display','hosts','projects','labels','background']);
 assert.ok(menu.props.header);assert.equal(h.nodes().filter(n=>n.props.accessibilityLabel==='Filter conversations').length,1);
});
test('project, label and background workspace filters intersect and clear restores all',async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.render();const items=()=>h.nodes().find(n=>n.type==='DropdownMenu').props.items;
 items().find(i=>i.id==='projects').items.find(i=>i.id==='p-remote').onSelect();h.render();assert.deepEqual(h.query().where({workspace:{key:'w-remote'},title:'test'}),true);assert.equal(h.query().where({workspace:{key:'w-local'},title:'test'}),false);
 items().find(i=>i.id==='labels').items.find(i=>i.id==='work').onSelect();h.render();assert.equal(h.query().where({workspace:{key:'w-remote'},title:'test'}),false);
 h.press('Clear filters');await new Promise(r=>setImmediate(r));h.render();assert.equal(h.query().where({workspace:{key:'w-remote'},title:'test'}),true);
 items().find(i=>i.id==='background').onSelect();await new Promise(r=>setImmediate(r));h.render();assert.equal(h.prefs.values.showBackground,false);assert.equal(h.query().where({workspace:{key:'w-remote'},title:'test'}),false);assert.equal(h.query().where({workspace:{key:'w-local'},title:'test'}),true);
});

test('drop into automatic project creates display membership and accepts another host',async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.prefs.values.grouping='server-project';h.render();
 const move=()=>h.nodes().find(n=>n.type==='ConversationDragProvider').props.move;
 assert.equal(await move()({hostId:'remote',agentId:'chat'},{hostId:'local',groupId:null,projectKey:'p-local',projectTitle:'Local project'}),true);h.render();
 const folder=h.owner.values.groups.find(group=>group.projectKey==='p-local');assert.ok(folder);assert.equal(h.owner.values.assignments[0].groupId,folder.id);
 assert.equal(await move()({hostId:'local',agentId:'another'},{hostId:'local',groupId:folder.id,projectKey:'p-local',projectTitle:'Local project'}),true);h.render();assert.equal(h.owner.values.groups.filter(group=>group.projectKey==='p-local').length,1);assert.equal(h.owner.values.assignments.length,2);
});

test('loading color saves independently and reaches all effect previews and automatic branches',async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.render();
 const display=()=>h.nodes().find(n=>n.type==='DropdownMenu').props.items.find(i=>i.id==='display');
 const content=display().items.find(i=>i.id==='loading-color').content;
 const purple=content.props.children[1].props.children.find(n=>n.props.accessibilityLabel==='Loading color: Purple');
 purple.props.onPress();await new Promise(r=>setImmediate(r));h.render();
 assert.equal(h.prefs.values.loadingColor,'#A78BFA');
 assert.ok(display().items.filter(i=>i.id.startsWith('loading-')&&i.preview).every(i=>i.preview.props.color==='#A78BFA'));
 h.nodes().find(n=>n.type==='DropdownMenu').props.items.find(i=>i.id==='grouping').items.find(i=>i.id==='server-project').onSelect();await new Promise(r=>setImmediate(r));h.render();
 assert.equal(h.nodes().find(n=>n.type==='AutomaticTree').props.conversationOptions.loadingColor,'#A78BFA');
});

test('collapse toggle restores the manual expansion snapshot on repeated cycles',async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.render();
 h.press('Folder 原有分组');assert.equal(h.find('Folder 原有分组').props.accessibilityState.expanded,true);
 h.press('Collapse all');assert.equal(h.find('Folder 原有分组').props.accessibilityState.expanded,false);
 h.press('Restore expansion');assert.equal(h.find('Folder 原有分组').props.accessibilityState.expanded,true);
 h.press('Folder 原有分组');h.press('Collapse all');h.press('Restore expansion');assert.equal(h.find('Folder 原有分组').props.accessibilityState.expanded,false);
});


const localChat=()=>({hostId:'local',id:'chat',title:'Review',status:'idle',requiresAttention:false,attentionReason:null,workspace:{key:'w-local'},createdAt:'2026-11-10',lastActivityAt:'2026-11-10'});
test('linked projects retain native members in manual, server and project views without modifying saved membership',async()=>{
 const h=harness([localChat()]);await new Promise(r=>setImmediate(r));h.owner.values.groups.push({id:'project-g',projectKey:'p-local',name:'Linked project',agentIds:[]});h.render();
 const project=h.nodes().find(node=>node.type==='ProjectFolder');assert.ok(project);assert.deepEqual(project.props.foldersForHost('local').find(g=>g.id==='project-g').agentIds,['chat']);
 assert.deepEqual(h.owner.values.groups.find(g=>g.id==='project-g').agentIds,[]);
 for(const grouping of ['server','server-project','project']){h.prefs.values.grouping=grouping;h.render();const tree=h.nodes().find(node=>node.type==='AutomaticTree');assert.equal(tree.props.assignedConversations.has('local:chat'),true);assert.deepEqual(tree.props.foldersForHost('local').find(g=>g.id==='project-g').agentIds,['chat']);}
});
test('legacy manual move replaces an existing drag assignment instead of being overridden',async()=>{
 const h=harness([localChat()]);await new Promise(r=>setImmediate(r));h.owner.values.groups.push({id:'destination',name:'Destination',agentIds:[]});h.owner.values.assignments=[{hostId:'local',agentId:'chat',folderHostId:'local',groupId:'local-folder'}];h.render();h.press('Folder 原有分组');
 const row=h.nodes().find(node=>typeof node.type==='function'&&node.type.name==='ConversationRow');assert.ok(row);row.props.select('chat');h.render();h.press('Folder Destination');await new Promise(r=>setImmediate(r));h.render();
 assert.equal(h.owner.values.assignments.length,1);assert.equal(h.owner.values.assignments[0].groupId,'destination');
 assert.ok(h.nodes().some(node=>node.type==='ConversationDropTarget'&&node.props.destination.groupId==='destination'&&node.props.destination.beforeId==='chat'));
 assert.ok(!h.nodes().some(node=>node.type==='ConversationDropTarget'&&node.props.destination.groupId==='local-folder'&&node.props.destination.beforeId==='chat'));
});


test('stale folder editors preserve drafts and never overwrite another client', async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.render();h.press('New folder');
 h.find('Folder name').props.onChangeText('My unsaved folder');h.render();
 h.owner.values.groups.push({id:'other-client',name:'Other client folder',agentIds:[]});h.owner.revision='2';h.render();
 h.press('Create');await new Promise(r=>setImmediate(r));h.render();
 assert.equal(h.find('Folder name').props.value,'My unsaved folder');
 assert.ok(h.nodes().some(n=>n.props.accessibilityRole==='alert'&&n.props.children.includes('another client')));
 assert.deepEqual(h.owner.values.groups.map(g=>g.name),['原有分组','Other client folder']);
 h.press('Cancel');h.press('New folder');h.find('Folder name').props.onChangeText('Fresh edit');h.render();h.press('Create');
 await new Promise(r=>setImmediate(r));h.render();assert.ok(h.owner.values.groups.some(g=>g.name==='Fresh edit'));
});

test('first drop beside or inside an unsaved project creates its metadata and preserves the source',async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.render();const move=h.nodes().find(n=>n.type==='FolderDragProvider').props.move;
 const project={id:'project:p-local',projectKey:'p-local',name:'Project',agentIds:[]};
 assert.equal(await move({hostId:'local',groupId:'local-folder'},{hostId:'local',parentId:project.id,project}),true);h.render();
 assert.equal(h.owner.values.groups.find(g=>g.id==='local-folder').parentId,project.id);assert.equal(h.owner.values.groups.filter(g=>g.projectKey==='p-local').length,1);
});

test('manual controls preserve the source host when moving a foreign conversation',async()=>{
 const foreign={...localChat(),hostId:'remote'};const h=harness([foreign]);await new Promise(r=>setImmediate(r));h.owner.values.groups[0].agentIds=['host-agent:["remote","chat"]'];h.owner.values.groups.push({id:'destination',name:'Destination',agentIds:[]});h.render();h.press('Folder 原有分组');
 const row=h.nodes().find(node=>typeof node.type==='function'&&node.type.name==='ConversationRow');assert.ok(row);row.props.select('chat');h.render();h.press('Folder Destination');await new Promise(r=>setImmediate(r));h.render();
 assert.equal(h.owner.values.assignments[0].hostId,'remote');assert.equal(h.owner.values.assignments[0].agentId,'chat');assert.equal(h.owner.values.assignments[0].groupId,'destination');
});
test('Move up stays inside its sibling list and cannot move a child above its parent',async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.owner.values.groups.push({id:'a',parentId:'local-folder',name:'First',agentIds:[]},{id:'b',parentId:'local-folder',name:'Second',agentIds:[]});h.render();h.press('Folder 原有分组');
 const menuFor=name=>{const nodes=h.nodes(),folder=h.find('Folder '+name);const index=nodes.indexOf(folder);return nodes.slice(index).find(n=>n.props.accessibilityLabel==='⋮')};
 menuFor('First').props.onPress();h.render();h.nodes().filter(n=>n.props.accessibilityLabel==='Move up')[1].props.onPress();await new Promise(r=>setImmediate(r));h.render();assert.deepEqual(h.owner.values.groups.map(g=>g.id),['local-folder','a','b']);
 menuFor('First').props.onPress();h.render();menuFor('Second').props.onPress();h.render();h.nodes().filter(n=>n.props.accessibilityLabel==='Move up')[2].props.onPress();await new Promise(r=>setImmediate(r));h.render();assert.deepEqual(h.owner.values.groups.map(g=>g.id),['local-folder','b','a']);assert.equal(h.owner.values.groups.find(g=>g.id==='b').parentId,'local-folder');
});

test('folder plus saves a batch from multiple servers atomically and rejects stale pickers',async()=>{
 const h=harness();await new Promise(r=>setImmediate(r));h.prefs.values.grouping='server-project';h.render();
 const tree=()=>h.nodes().find(n=>n.type==='AutomaticTree');const add=tree().props.addConversations;
 assert.equal(await add([{hostId:'local',id:'same'},{hostId:'remote',id:'same'}],{hostId:'local',groupId:'local-folder'},'1'),true);h.render();
 assert.deepEqual(h.owner.values.assignments.map(a=>[a.hostId,a.agentId,a.groupId]),[['local','same','local-folder'],['remote','same','local-folder']]);
 h.owner.revision='2';h.render();const before=JSON.stringify(h.owner.values);assert.equal(await tree().props.addConversations([{hostId:'local',id:'other'}],{hostId:'local',groupId:'local-folder'},'1'),false);assert.equal(JSON.stringify(h.owner.values),before);
 h.owner.save=async()=>false;assert.equal(await tree().props.addConversations([{hostId:'local',id:'other'}],{hostId:'local',groupId:'local-folder'},'2'),false);assert.equal(JSON.stringify(h.owner.values),before);
});
