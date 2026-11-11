const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const model={exports:{}};
const organizationModel={exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync(require.resolve('../shared/model.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText)(organizationModel.exports);
new Function('require','exports',ts.transpileModule(fs.readFileSync(require.resolve('../shared/sidebar-tabs.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText)(name=>{assert.equal(name,'./model');return organizationModel.exports},model.exports);
const {createSidebarTab,closeSidebarTab,reopenSidebarTab,updateSidebarTab,addTabMembers}=model.exports;
const initial=()=>({enabled:true,activeId:'all',tabs:[]});
test('custom tabs own independent folders and qualified conversation membership',()=>{
 const first=createSidebarTab(initial(),'work',' Work ');
 const withContent=updateSidebarTab(first,'work',{organization:{mode:'folders',groups:[{id:'g',name:'Ideas',agentIds:['chat']}],ungroupedOrder:[]},members:[{hostId:'local',agentId:'chat'}]});
 const next=createSidebarTab(withContent,'personal','Personal');
 assert.equal(next.activeId,'personal');assert.equal(next.tabs[0].name,'Work');assert.equal(next.tabs[0].organization.groups.length,1);assert.equal(next.tabs[1].organization.groups.length,0);assert.equal(next.tabs[1].members.length,0);
 assert.equal(first.tabs[0].organization.groups.length,0);
 const both=addTabMembers(withContent.tabs[0],[{hostId:'remote',agentId:'chat'},{hostId:'local',agentId:'chat'}]);assert.equal(both.length,2);
});
test('closing active tabs preserves content and reopening restores selection',()=>{
 let state=createSidebarTab(createSidebarTab(initial(),'a','A'),'b','B');state=updateSidebarTab(state,'b',{members:[{hostId:'local',agentId:'chat'}]});
 state=closeSidebarTab(state,'b');assert.equal(state.activeId,'a');assert.equal(state.tabs[1].open,false);assert.equal(state.tabs[1].members.length,1);
 state=closeSidebarTab(state,'a');assert.equal(state.activeId,'all');state=reopenSidebarTab(state,'b');assert.equal(state.activeId,'b');assert.equal(state.tabs[1].open,true);assert.equal(state.tabs[1].members.length,1);
 const disabled={...state,enabled:false};assert.equal(disabled.tabs.length,2);assert.equal(reopenSidebarTab(disabled,'a').enabled,true);
});
test('invalid creation and unavailable tab operations leave saved organization intact',()=>{
 const state=createSidebarTab(initial(),'a','A');assert.equal(createSidebarTab(state,'a','Other'),state);assert.equal(createSidebarTab(state,'all','All'),state);assert.equal(createSidebarTab(state,'b','  '),state);assert.equal(closeSidebarTab(state,'missing'),state);assert.equal(reopenSidebarTab(state,'missing'),state);
});
test('tab filtering separates same conversation IDs from different servers and intersects search',()=>{
 const mod={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync(require.resolve('../shared/conversations.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);
 const options={...mod.exports.defaultConversationOptions,members:[{hostId:'remote',agentId:'same'}],search:'review'};
 assert.equal(mod.exports.matchesConversation({hostId:'local',id:'same',title:'Review'},options),false);
 assert.equal(mod.exports.matchesConversation({hostId:'remote',id:'same',title:'Review'},options),true);
 assert.equal(mod.exports.matchesConversation({hostId:'remote',id:'same',title:'Other'},options),false);
 assert.equal(mod.exports.matchesConversation({hostId:'remote',id:'same',title:'Review'},{...options,members:[]}),false);
});

test('removing tab members prunes saved folders and overrides without resurrecting removed chats',()=>{
 const {memberId}=organizationModel.exports;
 const original=createSidebarTab(initial(),'a','A').tabs[0];
 const member={hostId:'remote',agentId:'chat'};
 const tab={...original,members:[{hostId:'local',agentId:'chat'},member],organization:{mode:'folders',groups:[{id:'g',name:'G',agentIds:['chat',memberId('local','remote','chat')]}],ungroupedOrder:['chat'],assignments:[{...member,folderHostId:'local',groupId:'g'}]},hosts:{remote:{mode:'folders',groups:[{id:'remote-folder',name:'Remote',agentIds:['chat']}],ungroupedOrder:['chat']}}};
 const next=model.exports.selectTabMembers(tab,[{hostId:'local',agentId:'chat'}],'local');
 assert.deepEqual(next.organization.groups[0].agentIds,['chat']);assert.deepEqual(next.organization.assignments,[]);assert.deepEqual(next.hosts.remote.groups[0].agentIds,[]);assert.deepEqual(next.hosts.remote.ungroupedOrder,[]);assert.deepEqual(next.members,[{hostId:'local',agentId:'chat'}]);assert.equal(tab.organization.groups[0].agentIds.length,2);
});
