const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
function load(file, imports={}) {
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(require.resolve(file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','exports',code)(name=>{assert.ok(name in imports,name);return imports[name]},mod.exports);
 return mod.exports;
}
const organizationModel=load('../shared/model.ts');
const tabsModel=load('../shared/sidebar-tabs.ts',{'./model':organizationModel});
function harness(active=false) {
 let cursor=0,states=[],tree,scope,controls;
 const effects=[],calls=[];
 const settings={status:'ready',revision:'1',values:active?tabsModel.createSidebarTab({enabled:true,activeId:'all',tabs:[]},'work','Work'):{enabled:true,activeId:'all',tabs:[]},async save(values,revision){calls.push({values,revision});this.values=values;this.revision=String(Number(this.revision)+1);return true}};
 const jsx=(type,props)=>({type,props:props||{}});
 const react={useState(value){const i=cursor++;if(!(i in states))states[i]=value;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next}]},useRef(value){const i=cursor++;if(!(i in states))states[i]={current:value};return states[i]},useEffect(fn){const i=cursor++;if(!(i in states)){states[i]=true;effects.push(fn)}}};
 const mod=load('../client/sidebar-tabs.tsx',{
  react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{Modal:'Modal',ScrollView:'ScrollView',Text:'Text',View:'View'},
  '@getpaseo/plugin/client/ui':{TextInput:'TextInput'},
  '@getpaseo/plugin/client':{useSettings:()=>settings,useRpc:()=>async()=>({hostId:'local'}),useAgents:()=>[],useHosts:()=>[],useAgent:()=>null},
  '../shared/settings':{sidebarTabs:{}},'../shared/host-context':{hostContext:{}},'../shared/model':organizationModel,'../shared/sidebar-tabs':tabsModel,
  './dropdown-menu':{DropdownMenu:'DropdownMenu'},'./visuals':{FeedbackPressable:'Pressable',Glyph:'Glyph'},
 });
 function render(){cursor=0;tree=mod.SidebarTabsView({view:{theme:{colors:{}},layout:{compact:false}},children(next,items){scope=next;controls=items;return jsx('Content',{})}})}
 function nodes(node,out=[]){if(Array.isArray(node))node.forEach(child=>nodes(child,out));else if(node&&typeof node==='object'){out.push(node);nodes(node.props?.children,out)}return out}
 function find(label){return nodes(tree).find(node=>node.props.accessibilityLabel===label)}
 function press(label){const node=find(label);assert.ok(node,label);if(!node.props.disabled)node.props.onPress();render()}
 render();effects.forEach(fn=>fn());
 return {settings,calls,render,find,press,scope:()=>scope,controls:()=>controls};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('new tab uses revision-aware save, activates independently, and closes without deleting content',async()=>{
 const h=harness();await tick();h.render();h.press('New tab');h.find('Tab name').props.onChangeText('Research');h.render();h.press('Save tab');await tick();h.render();assert.equal(h.calls.length,1);assert.equal(h.calls[0].revision,'1');assert.equal(h.scope().tab.name,'Research');
 h.press('Close tab Research');await tick();h.render();assert.equal(h.scope(),undefined);assert.equal(h.settings.values.tabs[0].open,false);
 h.controls().items.find(item=>item.id.startsWith('reopen-')).onSelect();await tick();h.render();assert.equal(h.scope().tab.name,'Research');
});
test('save failure preserves tab draft and prevents duplicate submissions',async()=>{
 const h=harness();await tick();h.render();let finish;h.settings.save=async(values,revision)=>{h.calls.push({values,revision});return new Promise(resolve=>finish=resolve)};
 h.press('New tab');h.find('Tab name').props.onChangeText('Retry me');h.render();const submit=h.find('Save tab');submit.props.onPress();submit.props.onPress();h.render();assert.equal(h.calls.length,1);assert.equal(h.find('Save tab').props.disabled,true);finish(false);await tick();h.render();assert.equal(h.find('Tab name').props.value,'Retry me');assert.equal(h.settings.values.tabs.length,0);assert.equal(h.find('Save tab').props.disabled,false);
});
test('stale dialog revisions cannot write to a newly selected or changed tab',async()=>{
 const h=harness();await tick();h.render();h.press('New tab');h.find('Tab name').props.onChangeText('Stale');h.settings.revision='2';h.render();h.press('Save tab');await tick();h.render();assert.equal(h.calls.length,0);assert.equal(h.find('Tab name').props.value,'Stale');
});
test('tab scope commits cross-host project metadata and qualified assignment together',async()=>{
 const h=harness(true);await tick();h.render();const organization={mode:'folders',groups:[],ungroupedOrder:[],assignments:[{hostId:'third',agentId:'chat',folderHostId:'remote',groupId:'project-g'}]};
 const hosts={remote:{mode:'folders',groups:[{id:'project-g',name:'Project',projectKey:'project',agentIds:[]}],ungroupedOrder:[]}};
 assert.equal(await h.scope().saveOrganization(organization,'1',hosts),true);h.render();assert.equal(h.calls.length,1);assert.equal(h.settings.values.tabs[0].hosts.remote.groups[0].id,'project-g');assert.deepEqual(h.settings.values.tabs[0].members,[{hostId:'third',agentId:'chat'}]);
});
test('disabling custom tabs preserves saved views and restores access through Filter controls',async()=>{
 const h=harness(true);await tick();h.render();h.controls().items.find(item=>item.id==='enabled').onSelect();await tick();h.render();assert.equal(h.controls().enabled,false);assert.equal(h.scope(),undefined);assert.equal(h.find('New tab'),undefined);assert.equal(h.settings.values.tabs.length,1);
 h.controls().items.find(item=>item.id==='enabled').onSelect();await tick();h.render();assert.equal(h.scope().tab.id,'work');assert.ok(h.find('New tab'));
});

test('custom tab label and close use one shared hover surface', async()=>{
 const h=harness(true);await tick();h.render();
 for(const label of ['Select tab All','Select tab Work','Close tab Work']) {
  const button=h.find(label);assert.ok(button,label);assert.equal(button.props.hoverBackground,'transparent');
 }
 assert.equal(h.find('Close tab Work').props.style.flexShrink,0);
});

test('tab surface highlights label and close together and clears hover without losing selection',()=>{
 let cursor=0;const states=[];const jsx=(type,props)=>({type,props:props||{}});
 const mod=load('../client/sidebar-tabs.tsx',{
  react:{useState(value){const i=cursor++;if(!(i in states))states[i]=value;return[states[i],next=>states[i]=next]},useEffect(){},useRef:()=>({})},
  'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Animated:{View:'AnimatedView'},Platform:{OS:'web'}},
  '@getpaseo/plugin/client':{},'@getpaseo/plugin/client/ui':{},'../shared/settings':{},'../shared/host-context':{},'../shared/model':{},'../shared/sidebar-tabs':{},'./dropdown-menu':{},'./visuals':{useMotion:target=>target},
 });
 const view={theme:{colors:{surface1:'hover',surface2:'selected'}}};
 const render=(selected=false,disabled=false)=>{cursor=0;return mod.SidebarTabSurface({selected,disabled,view,limited:true,children:['label','close']})};
 const layer=node=>node.props.children[0].props;
 let node=render();assert.equal(layer(node).style.opacity,0);assert.equal(layer(node).pointerEvents,'none');
 node.props.onPointerEnter({nativeEvent:{pointerType:'touch'}});assert.equal(layer(render()).style.opacity,0);
 node.props.onPointerEnter({nativeEvent:{pointerType:'mouse'}});node=render();assert.equal(layer(node).style.opacity,1);assert.equal(layer(node).style.backgroundColor,'hover');
 assert.deepEqual([layer(node).style.left,layer(node).style.right],[0,0]);assert.equal(node.props.style.maxWidth,160);
 node.props.onPointerLeave();assert.equal(layer(render()).style.opacity,0);assert.equal(layer(render(true)).style.opacity,1);assert.equal(layer(render(true)).style.backgroundColor,'selected');
 node.props.onFocus({target:{matches:()=>false}});assert.equal(layer(render()).style.opacity,0);
 node.props.onFocus({target:{matches:()=>true}});assert.equal(layer(render()).style.opacity,1);
 node.props.onBlur({currentTarget:{contains:()=>true},relatedTarget:{}});assert.equal(layer(render()).style.opacity,1);
 node.props.onBlur({currentTarget:{contains:()=>false},relatedTarget:null});assert.equal(layer(render()).style.opacity,0);
 node.props.onPointerEnter({nativeEvent:{pointerType:'mouse'}});assert.equal(layer(render(false,true)).style.opacity,0);
});
