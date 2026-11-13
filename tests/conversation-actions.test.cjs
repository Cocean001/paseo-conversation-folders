const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function harness({host='local',fail=false,unconfirmed=false,branch='main',dragging=false}={}) {
 const calls=[],effects=[],states=[];let cursor=0,tree;
 const jsx=(type,props)=>({type,props});const imports={
  './action-dialog':{ActionDialog:'ActionDialog'},'./web':{isSidebarDragging:()=>dragging,showConversationTooltip:()=>()=>{}},'../shared/activity':{activityTime:()=> 'now'},react:{useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]},useRef(v){const i=cursor++;if(!(i in states))states[i]={current:v};return states[i]},useEffect(fn){const i=cursor++;if(!(i in states)){states[i]=true;effects.push(fn)}}},
  'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Text:'Text'},'./context-menu':{ContextMenu:'ContextMenu'},'./visuals':{ActionRow:'ActionRow',FeedbackPressable:'Button',Glyph:'Glyph'},'../shared/host-context':{hostContext:'host'},'../shared/conversation-actions':{deleteConversation:'delete',renameConversation:'rename'},
  '@getpaseo/plugin/client/ui':{Modal:Object.assign('Modal',{Content:'Content'}),TextInput:'Input',copyText:async text=>calls.push(['copy',text])},
  '@getpaseo/plugin/client':{useHosts:()=>[{serverId:'local',label:'MacBook'}],useRpc:contract=>contract==='host'?async()=>({hostId:'local'}):contract==='rename'?async input=>{calls.push(['rename-agent',input]);return {renamed:true,title:input.title}}:async input=>{calls.push(['delete',input]);},useAgent:()=>({title:'Test',workspace:{hostId:host,id:'workspace',kind:'workspace',key:'workspace-ref'}}),useWorkspace:()=>({name:'Workspace',directory:'/sample',branch,labels:['work'],pinned:false}),usePaseo:()=>({agents:{ref:ref=>({async setMetadata(){},async archive(){calls.push(['archive-agent',ref]);if(fail)throw Error('Source offline');return {archivedAt:'2026-11-11T00:00:00Z'}}})},workspaces:{ref:ref=>({async archive(){calls.push(['archive-workspace',ref]);return{error:null,archivedAt:unconfirmed?null:'2026-11-11T00:00:00Z'}},async setPinned(value){calls.push(['pin',ref,value])},async setTitle(value){calls.push(['rename',ref,value]);if(fail)throw Error('Source offline');return{title:unconfirmed?'wrong':value}},async setLabel(value,options){calls.push(['label',ref,value,options])}})}})}
 };
 const source=ts.transpileModule(fs.readFileSync(require.resolve('../client/conversation-actions.tsx'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const m={exports:{}};new Function('require','exports',source)(n=>imports[n],m.exports);
 const reference={hostId:host,id:'test-id',kind:'agent',key:'test-ref'};
 const render=()=>{cursor=0;tree=m.exports.ConversationActions({reference,view:{active:{agent:null},theme:{colors:{}},layout:{compact:false,platform:'web'},navigation:{openWorkspace:ref=>calls.push(['open',ref])}},children:()=> 'row'})};
 function walk(n,out=[]){if(Array.isArray(n))n.forEach(x=>walk(x,out));else if(n&&typeof n==='object'){out.push(n);walk(n.props?.children,out);if(n.type==='ActionRow')walk(n.props?.action,out)}return out}
 render();effects.forEach(fn=>fn());return{calls,reference,render,nodes:()=>walk(tree),action:id=>walk(tree).find(n=>n.type==='ContextMenu').props.actions.find(a=>a.id===id),find:label=>walk(tree).find(n=>n.props?.accessibilityLabel===label)};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('archive waits for confirmation and routes to the conversation source host',async()=>{const h=harness({host:'remote'});await tick();h.render();h.action('archive-agent').onSelect();h.render();assert.deepEqual(h.calls,[]);const confirm=h.find('Confirm conversation action');confirm.props.onPress();confirm.props.onPress();await tick();h.render();assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0],['archive-agent',h.reference]);assert.equal(h.action('delete-agent').disabled,true)});
test('deletion passes the confirmed exact ID and workspace archive remains a separate action',async()=>{const h=harness();await tick();h.render();assert.equal(h.action('delete-agent').disabled,false);h.action('delete-agent').onSelect();h.render();assert.deepEqual(h.calls,[]);h.find('Confirm conversation action').props.onPress();await tick();h.render();assert.deepEqual(h.calls[0],['delete',{hostId:'local',agentId:'test-id',confirmAgentId:'test-id'}]);h.action('archive-workspace').onSelect();h.render();h.find('Confirm conversation action').props.onPress();await tick();assert.equal(h.calls[1][0],'archive-workspace')});
test('archive failure keeps confirmation open and shows the actual error',async()=>{const h=harness({fail:true});await tick();h.render();h.action('archive-agent').onSelect();h.render();h.find('Confirm conversation action').props.onPress();await tick();h.render();assert.ok(h.nodes().some(n=>n.props?.accessibilityRole==='alert'&&n.props.children==='Source offline'));assert.ok(h.find('Confirm conversation action'))});

test('missing workspace archive confirmation stays visible as an error',async()=>{const h=harness({unconfirmed:true});await tick();h.render();h.action('archive-workspace').onSelect();h.render();h.find('Confirm conversation action').props.onPress();await tick();h.render();assert.ok(h.nodes().some(n=>n.props?.accessibilityRole==='alert'&&n.props.children==='The host did not confirm archiving the workspace. Try again.'));assert.ok(h.find('Confirm conversation action'))});

test('inline archive opens the same confirmation without archiving immediately',async()=>{const h=harness();await tick();h.render();h.find('Archive Test').props.onPress();h.render();assert.deepEqual(h.calls,[]);h.find('Confirm conversation action').props.onPress();await tick();assert.equal(h.calls[0][0],'archive-agent')});

test('conversation and workspace rename have separate targets and visible save/cancel controls',async()=>{const h=harness();await tick();h.render();h.action('rename-agent').onSelect();h.render();h.find('Conversation name').props.onChangeText('Renamed chat');h.render();h.find('Confirm conversation action').props.onPress();await tick();h.render();assert.deepEqual(h.calls[0],['rename-agent',{hostId:'local',agentId:'test-id',title:'Renamed chat'}]);h.action('rename').onSelect();h.render();h.find('Workspace name').props.onChangeText('Renamed workspace');h.render();h.find('Confirm conversation action').props.onPress();await tick();assert.equal(h.calls[1][0],'rename');assert.equal(h.calls[1][2],'Renamed workspace')});
test('rename cancellation writes nothing and failed confirmation retains the draft',async()=>{const h=harness({unconfirmed:true});await tick();h.render();h.action('rename').onSelect();h.render();h.find('Cancel conversation action').props.onPress();assert.equal(h.calls.length,0);h.action('rename').onSelect();h.render();h.find('Workspace name').props.onChangeText('Retry title');h.render();h.find('Confirm conversation action').props.onPress();await tick();h.render();assert.equal(h.find('Workspace name').props.value,'Retry title');assert.ok(h.nodes().some(n=>n.props?.accessibilityRole==='alert'))});


test('Enter on an empty conversation name or label never submits', async () => {
 const h=harness();await tick();h.render();
 for(const [action,input] of [['rename-agent','Conversation name'],['labels','New workspace label']]) {
  h.action(action).onSelect();h.render();h.find(input).props.onChangeText('   ');h.render();
  assert.equal(h.find('Confirm conversation action').props.disabled,true);
  h.find(input).props.onSubmitEditing();await tick();h.render();
  assert.deepEqual(h.calls,[]);assert.ok(!h.nodes().some(n=>n.props?.accessibilityRole==='alert'));
  h.find('Cancel conversation action').props.onPress();h.render();
 }
});


test('copy and native workspace navigation retain exact source-host targets', async()=>{
 const h=harness({host:'remote'});await tick();h.render();
 h.action('copy-path').onSelect();await tick();h.render();
 h.action('copy-branch').onSelect();await tick();h.render();
 h.action('open-workspace').onSelect();
 assert.deepEqual(h.calls,[['copy','/sample'],['copy','main'],['open',{hostId:'remote',id:'workspace',kind:'workspace',key:'workspace-ref'}]]);
 assert.equal(h.action('rename-agent').disabled,true);assert.equal(h.action('delete-agent').disabled,true);
});
test('copy branch is unavailable when the source workspace has no branch', async()=>{
 const h=harness({branch:null});await tick();h.render();
 assert.equal(h.action('copy-branch').disabled,true);assert.equal(h.action('copy-path').disabled,false);
});

test('long-press More cannot open a menu over an active sidebar drag',()=>{
 const h=harness({dragging:true});assert.doesNotThrow(()=>h.find('More actions for Test').props.onLongPress());h.render();assert.equal(h.nodes().find(n=>n.type==='ContextMenu').props.anchor,null);
});
