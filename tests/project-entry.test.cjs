const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function harness(status = 'online') {
  let cursor = 0, states = [], tree, calls = [], resolveOpen, rejectOpen;
  const jsx = (type, props) => ({ type, props: props || {} });
  const imports = {
    '../shared/status': {aggregateStates:()=>({state:'idle',hasUpdates:false})}, '../shared/model': {}, './drag-and-drop': {}, './conversation-view': {useConversationView:()=>({options:{}})}, '../shared/conversations': {}, './context-menu': {}, './image-picker': {}, './visuals': { FeedbackPressable: 'Pressable', Glyph: 'Glyph', StatusMark: 'StatusMark', EntryReveal: 'EntryReveal' }, '../shared/settings': {},
    react: { useEffect() {}, useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; }, useRef(value) { const i = cursor++; if (!(i in states)) states[i] = { current: value }; return states[i]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { View: 'View', Pressable: 'Pressable', Text: 'Text' }, '@getpaseo/plugin/client/ui': { TextInput: 'TextInput' },
    '@getpaseo/plugin/client': {useAgents:()=>[]},
  };
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../client/automatic-tree.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', code + '\nexports.HostBranch = HostBranch;')(name => { assert.ok(name in imports, name); return imports[name]; }, mod.exports);
  function render() { cursor = 0; tree = mod.exports.HostBranch({host:{serverId:'remote',label:'MacBook',status},mode:'server-project',createFolder(host,name){calls.push({host,name});return new Promise((resolve,reject)=>{resolveOpen=resolve;rejectOpen=reject;});},view:{theme:{colors:{}},layout:{compact:false},navigation:{openWorkspace(){}}},row(){}}); }
  function walk(node, out=[]) { if(Array.isArray(node))node.forEach(n=>walk(n,out));else if(node&&typeof node==='object'){out.push(node);walk(node.props.children,out);}return out; }
  const nodes = () => [...walk(tree.props.action), ...walk(tree.props.editor), ...walk(tree.props.children)];
  const find = label => nodes().find(n=>n.props.accessibilityLabel===label);
  const press = label => { if(label==='New folder on MacBook'){const menu=nodes().find(n=>n.props.actions);const action=menu.props.actions.find(a=>a.id==='new-folder');if(!action.disabled)action.onSelect();render();return;} const node=find(label); assert.ok(node,label); if(!node.props.disabled)node.props.onPress(); render(); };
  render();
  return {find,press,render,nodes,calls,reject:message=>rejectOpen(new Error(message)),resolve:value=>resolveOpen(value)};
}
test('host plus opens compact single-level entry and Escape dismisses it', () => {
  const h=harness();h.press('New folder on MacBook');
  const input=h.find('Folder name on MacBook');assert.ok(input);assert.equal(input.props.autoFocus,true);
  assert.equal(h.find('Create folder').props.disabled,true);
  input.props.onKeyPress({nativeEvent:{key:'Escape'}});h.render();assert.equal(h.find('Folder name on MacBook').props.editable,false);
});
test('arbitrary names save as host folders, duplicate requests are prevented and failures are reported', async () => {
  const h=harness();h.press('New folder on MacBook');h.find('Folder name on MacBook').props.onChangeText('123123');h.render();
  const submit=h.find('Create folder');submit.props.onPress();submit.props.onPress();h.render();
  assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0],{host:'remote',name:'123123'});
  assert.equal(h.find('Creating folder').props.disabled,true);
  h.reject('Save failed');await new Promise(resolve=>setImmediate(resolve));h.render();
  assert.ok(h.nodes().some(n=>n.props.accessibilityRole==='alert'&&n.props.children==='Could not save. Check the server connection and try again.'));
  h.find('Folder name on MacBook').props.onChangeText('/another');h.render();assert.ok(!h.nodes().some(n=>n.props.accessibilityRole==='alert'));
});
test('offline hosts cannot open project entry',()=>{const h=harness('offline');assert.equal(h.nodes().find(n=>n.props.actions).props.actions[0].disabled,true);h.press('New folder on MacBook');assert.equal(h.find('Folder name on MacBook').props.editable,false);});

test('successful arbitrary folder creation closes entry without opening a directory', async()=>{
 const h=harness();h.press('New folder on MacBook');h.find('Folder name on MacBook').props.onChangeText('我的项目 123123');h.render();h.press('Create folder');h.resolve(true);await new Promise(r=>setImmediate(r));h.render();assert.equal(h.find('Folder name on MacBook').props.editable,false);assert.deepEqual(h.calls,[{host:'remote',name:'我的项目 123123'}]);
});

test('top-level folders render as siblings of host branches and stay out of host children',()=>{
 const jsx=(type,props)=>({type,props});const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(require.resolve('../client/automatic-tree.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','exports',code)(name=>name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='./conversation-view'?{ConversationViewContext:{Provider:'Provider'}}:{},mod.exports);
 const groups=[{id:'root',name:'Root folder',topLevel:true,agentIds:[]},{id:'nested',name:'Host folder',agentIds:[]}];
 const tree=mod.exports.AutomaticTree({mode:'server-project',hosts:[{serverId:'local',label:'MacBook'}],view:{},row(){},createFolder(){},foldersForHost:()=>groups});
 const [hosts,roots]=tree.props.children;assert.equal(roots[0].props.group.id,'root');assert.deepEqual(hosts[0].props.groups.map(g=>g.id),['nested']);
});
