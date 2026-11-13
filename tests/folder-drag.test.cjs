const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, imports) {
 const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(require.resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','exports',code)(name=>imports[name],mod.exports);return mod.exports;
}
const model=load('../shared/model.ts',{});
function harness(source={hostId:'local',groupId:'a'}) {
 let cursor=0,tree,component,props;const states=[],effects=[],cleanup=[],moves=[];
 const node={events:new Map(),style:{opacity:''},draggable:false,contains:()=>false,getBoundingClientRect:()=>({top:100,height:40,bottom:140}),addEventListener(type,fn){this.events.set(type,fn)},removeEventListener(type,fn){if(this.events.get(type)===fn)this.events.delete(type)}};
 const document={events:new Map(),addEventListener:node.addEventListener,removeEventListener:node.removeEventListener};node.ownerDocument=document;
 const context={current:{current:source},groups:()=>[{id:'a',name:'A',agentIds:[]},{id:'b',name:'B',agentIds:[]},{id:'child',name:'Child',parentId:'b',agentIds:[]}],async move(source,destination){moves.push({source,destination});return false}};
 const react={createContext:()=>({}),useContext:()=>context,useRef(value){const i=cursor++;if(!(i in states))states[i]={current:value};return states[i]},useState(value){const i=cursor++;if(!(i in states))states[i]=value;return[states[i],next=>states[i]=next]},useEffect(fn){const i=cursor++;if(!(i in states)){states[i]=true;effects.push(fn)}}};
 const jsx=(type,props)=>({type,props});const mod=load('../client/folder-drag.tsx',{'../shared/model':model,react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Platform:{OS:'web'}}});
 const render=()=>{cursor=0;tree=component(props)};
 const mount=(name,p)=>{component=mod[name];props=p;render();tree.props.ref.current=node;effects.forEach(fn=>cleanup.push(fn()))};
 const transfer={types:['application/x-paseo-sidebar-folder'],data:{},setData(type,value){this.data[type]=value},getData(type){return this.data[type]||JSON.stringify(source)}};
 let prevented=0,stopped=0;const event={dataTransfer:transfer,clientY:120,preventDefault(){prevented++},stopPropagation(){stopped++}};
 return{node,document,context,moves,event,transfer,mount,render,tree:()=>tree,prevented:()=>prevented,stopped:()=>stopped,cleanup:()=>cleanup.forEach(fn=>fn?.())};
}
const view={theme:{colors:{accent:'blue',surface1:'hover'}}};
test('folder drag uses its own payload and cancels without moving data',()=>{
 const h=harness();h.mount('DragFolderRow',{source:{hostId:'local',groupId:'a'},children:'row'});h.node.events.get('dragstart')(h.event);
 assert.equal(h.node.draggable,true);assert.deepEqual(JSON.parse(h.transfer.data['application/x-paseo-sidebar-folder']),{hostId:'local',groupId:'a'});
 h.node.events.get('dragend')();assert.equal(h.context.current.current,null);assert.equal(h.node.style.opacity,'');assert.equal(h.moves.length,0);h.cleanup();assert.equal(h.node.draggable,false);assert.equal(h.node.events.size,0);
});
test('folder center nests once, failed save retains source, and drop feedback clears',async()=>{
 const h=harness();h.mount('FolderDropTarget',{hostId:'local',group:{id:'b',name:'B',agentIds:[]},view,children:'row'});
 h.node.events.get('dragover')(h.event);h.render();assert.ok(h.tree().props.children[1]);
 h.node.events.get('drop')(h.event);h.node.events.get('drop')(h.event);await new Promise(r=>setImmediate(r));h.render();
 assert.equal(h.moves.length,1);assert.deepEqual(h.moves[0],{source:{hostId:'local',groupId:'a'},destination:{hostId:'local',parentId:'b'}});assert.equal(h.tree().props.children[1],null);h.cleanup();assert.equal(h.document.events.size,0);
});
test('folder edges reorder, third-level and cross-host drops do not bubble to ancestors',()=>{
 const h=harness();h.mount('FolderDropTarget',{hostId:'local',group:{id:'child',name:'Child',parentId:'b',agentIds:[]},view,children:'row'});
 h.node.events.get('dragover')(h.event);assert.equal(h.prevented(),0);assert.equal(h.stopped(),1);
 h.event.clientY=101;h.node.events.get('drop')(h.event);assert.equal(h.moves[0].destination.parentId,'b');assert.equal(h.moves[0].destination.position,'before');h.cleanup();
 const remote=harness({hostId:'remote',groupId:'a'});remote.mount('FolderDropTarget',{hostId:'local',root:true,view,children:'root'});remote.node.events.get('drop')(remote.event);assert.equal(remote.moves.length,0);assert.equal(remote.stopped(),1);remote.cleanup();
});

test('a native project without saved folder metadata can be dropped into a folder',async()=>{
 const project={id:'project:p',projectKey:'p',name:'Blue star',agentIds:[]};
 const h=harness({hostId:'local',groupId:project.id,project});h.mount('FolderDropTarget',{hostId:'local',group:{id:'b',name:'B',agentIds:[]},view,children:'row'});
 h.node.events.get('drop')(h.event);await new Promise(r=>setImmediate(r));assert.equal(h.moves.length,1);assert.equal(h.moves[0].source.project.projectKey,'p');assert.equal(h.moves[0].destination.parentId,'b');h.cleanup();
});

test('empty content always nests even near its edge, and folder drag scrolls a long sidebar',()=>{
 const h=harness();const scroll={scrollHeight:1000,clientHeight:400,scrollTop:100,getBoundingClientRect:()=>({top:0,bottom:400}),parentElement:null};h.node.parentElement=scroll;
 h.mount('FolderDropTarget',{hostId:'local',group:{id:'b',name:'B',agentIds:[]},insideOnly:true,view,children:'Empty'});h.event.clientY=101;h.node.events.get('drop')(h.event);assert.equal(h.moves[0].destination.parentId,'b');assert.equal(h.moves[0].destination.position,undefined);h.cleanup();
 const long=harness();long.node.parentElement=scroll;long.mount('FolderDropTarget',{hostId:'local',root:true,view,children:'Root'});long.event.clientY=395;long.node.events.get('dragover')(long.event);assert.equal(scroll.scrollTop,112);long.cleanup();
});
test('an unsaved project can receive a folder without dropping to the host instead',()=>{
 const h=harness();const project={id:'project:p',projectKey:'p',name:'Star',agentIds:[]};h.mount('FolderDropTarget',{hostId:'local',group:project,view,children:'Star'});h.node.events.get('drop')(h.event);assert.equal(h.moves[0].destination.parentId,project.id);assert.deepEqual(h.moves[0].destination.project,project);h.cleanup();
});

test('a successful drop opens a collapsed destination even without a long hover',async()=>{
 const h=harness();let expanded=0;h.context.move=async()=>true;
 h.mount('FolderDropTarget',{hostId:'local',group:{id:'b',name:'B',agentIds:[]},view,children:'row',activate(){expanded++}});h.node.events.get('drop')(h.event);await new Promise(r=>setImmediate(r));assert.equal(expanded,1);h.cleanup();
});

test('the shared sidebar heading promotes a folder while preserving its remote owner host',()=>{
 const h=harness({hostId:'remote',groupId:'a'});h.mount('FolderDropTarget',{hostId:'local',root:true,anyHost:true,view,children:'Heading'});h.node.events.get('drop')(h.event);assert.equal(h.moves.length,1);assert.equal(h.moves[0].destination.hostId,'remote');assert.equal(h.moves[0].destination.topLevel,true);h.cleanup();
});
