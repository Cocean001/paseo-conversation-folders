const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const moduleObject = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync(require.resolve('../shared/model.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
new Function('exports', compiled)(moduleObject.exports);
const { moveAgent, moveGroup, removeGroup, orderedIds } = moduleObject.exports;
const initial = () => ({ mode: 'folders', groups: [{ id: 'a', name: '工作', agentIds: ['1', '2'] }, { id: 'b', name: '个人', agentIds: ['3'] }], ungroupedOrder: ['4'] });
test('cross-folder move preserves source state and has exactly one membership', () => { const s = initial(); const next = moveAgent(s, '1', 'b'); assert.deepEqual(next.groups[0].agentIds, ['2']); assert.deepEqual(next.groups[1].agentIds, ['3', '1']); assert.deepEqual(s, initial()); });
test('reorder a conversation before another', () => { assert.deepEqual(moveAgent(initial(), '2', 'a', '1').groups[0].agentIds, ['2', '1']); });
test('move to ungrouped', () => { const next = moveAgent(initial(), '1', null); assert.deepEqual(next.ungroupedOrder, ['4', '1']); assert.deepEqual(next.groups[0].agentIds, ['2']); });
test('invalid destination never loses membership', () => { const s = initial(); assert.equal(moveAgent(s, '1', 'missing'), s); });
test('drop onto itself is a no-op', () => { const s = initial(); assert.equal(moveAgent(s, '1', 'a', '1'), s); });
test('move group', () => { assert.deepEqual(moveGroup(initial(), 'b', 'a').groups.map(g => g.id), ['b', 'a']); });
test('delete group keeps all conversations in ungrouped', () => { const next = removeGroup(initial(), 'a'); assert.deepEqual(next.ungroupedOrder, ['4', '1', '2']); assert.equal(next.groups.length, 1); });
test('sort manual order, filter stale entries, include new arrivals', () => { assert.deepEqual(orderedIds(['a', 'b', 'c'], ['stale', 'b', 'b']), ['b', 'a', 'c']); });
test('mode change does not change memberships', () => { const s = initial(); assert.deepEqual({ ...s, mode: 'dividers' }.groups, s.groups); });

test('cross-host identities preserve colliding agent IDs and reorder by both host and ID',()=>{
 const {memberId,memberRef,applyAssignments}=moduleObject.exports;const s={mode:'folders',groups:[{id:'f',name:'Shared',agentIds:['same']}],ungroupedOrder:[]};
 const remote=memberId('local','remote','same');assert.deepEqual(memberRef('local',remote),{hostId:'remote',agentId:'same'});
 const next=applyAssignments(s,'local',[{hostId:'remote',agentId:'same',folderHostId:'local',groupId:'f',beforeId:'same',beforeHostId:'local'}]);assert.deepEqual(next.groups[0].agentIds,[remote,'same']);assert.deepEqual(s.groups[0].agentIds,['same']);
 assert.equal(applyAssignments(s,'local',[{hostId:'local',agentId:'same',folderHostId:'remote',groupId:'other'}]).groups[0].agentIds.length,0);
 assert.deepEqual(applyAssignments(s,'local',[{hostId:'local',agentId:'same',folderHostId:'local',groupId:'deleted'}]).groups[0].agentIds,['same']);
});

test('promoting children removes parentId instead of serializing undefined',()=>{
 const fs=require('node:fs'),ts=require('typescript');const m={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync(require.resolve('../shared/model.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports);
 const state={mode:'folders',groups:[{id:'p',name:'Parent',agentIds:[]},{id:'c',name:'Child',parentId:'p',agentIds:[]}],ungroupedOrder:[]};const next=m.exports.removeGroup(state,'p');assert.equal(Object.hasOwn(next.groups[0],'parentId'),false);assert.deepEqual(next,JSON.parse(JSON.stringify(next)));
});


test('deleting a top-level parent preserves promoted children beside hosts', () => {
  const state = { mode: 'folders', groups: [
    { id: 'root', name: 'Root', topLevel: true, agentIds: ['a'] },
    { id: 'child', name: 'Child', parentId: 'root', agentIds: ['b'] },
    { id: 'host', name: 'Host folder', agentIds: ['c'] },
  ], ungroupedOrder: [] };
  const next = removeGroup(state, 'root');
  assert.deepEqual(next.groups[0], { id: 'child', name: 'Child', topLevel: true, agentIds: ['b'] });
  assert.deepEqual(next.groups[1], state.groups[2]);
  assert.deepEqual(next.ungroupedOrder, ['a']);
  assert.equal(state.groups[1].parentId, 'root');
  assert.deepEqual(JSON.parse(JSON.stringify(next)), next);
});


test('folder reparenting preserves conversations, removes root marker, and promotes back cleanly',()=>{
 const {relocateGroup}=moduleObject.exports;const state={mode:'folders',groups:[{id:'a',name:'A',topLevel:true,agentIds:['1']},{id:'b',name:'B',topLevel:true,agentIds:['2']}],ungroupedOrder:['3'],assignments:[{hostId:'local',agentId:'1',folderHostId:'local',groupId:'a'}]};
 const nested=relocateGroup(state,'a',{parentId:'b'});assert.deepEqual(nested.groups.find(g=>g.id==='a'),{id:'a',name:'A',agentIds:['1'],parentId:'b'});assert.deepEqual(nested.assignments,state.assignments);assert.equal(state.groups[0].topLevel,true);
 const root=relocateGroup(nested,'a',{parentId:null,topLevel:true});assert.equal(root.groups.find(g=>g.id==='a').topLevel,true);assert.equal(Object.hasOwn(root.groups.find(g=>g.id==='a'),'parentId'),false);assert.deepEqual(root,JSON.parse(JSON.stringify(root)));
 const host=relocateGroup(root,'a',{parentId:null,topLevel:false});assert.equal(Object.hasOwn(host.groups.find(g=>g.id==='a'),'topLevel'),false);
});
test('folder drops reject cycles, a third level, parents with children, and stale destinations',()=>{
 const {relocateGroup}=moduleObject.exports;const state={mode:'folders',groups:[{id:'a',name:'A',agentIds:[]},{id:'b',name:'B',agentIds:[]},{id:'child',name:'Child',parentId:'a',agentIds:[]},{id:'project',name:'Project',projectKey:'p',agentIds:[]}],ungroupedOrder:[]};
 for(const [source,destination] of [['a',{parentId:'a'}],['a',{parentId:'child'}],['b',{parentId:'child'}],['a',{parentId:'b'}],['b',{parentId:'missing'}],['b',{parentId:null,siblingId:'b'}]])assert.equal(relocateGroup(state,source,destination),state);
});
test('folder edge reordering uses sibling placement and leaves member IDs unchanged',()=>{
 const {relocateGroup}=moduleObject.exports;const state={mode:'folders',groups:[{id:'a',name:'A',topLevel:true,agentIds:['x']},{id:'b',name:'B',topLevel:true,agentIds:['y']},{id:'c',name:'C',topLevel:true,agentIds:[]}],ungroupedOrder:[]};
 assert.deepEqual(relocateGroup(state,'c',{parentId:null,topLevel:true,siblingId:'a',position:'before'}).groups.map(g=>g.id),['c','a','b']);
 assert.deepEqual(relocateGroup(state,'a',{parentId:null,topLevel:true,siblingId:'b',position:'after'}).groups.map(g=>g.id),['b','a','c']);
});

test('project groups can be nested, promoted and reordered without losing their identity or members',()=>{
 const {relocateGroup}=moduleObject.exports;const state={mode:'folders',groups:[{id:'folder',name:'Folder',agentIds:[]},{id:'project',name:'Project',projectKey:'p',agentIds:['chat']}],ungroupedOrder:[]};
 const nested=relocateGroup(state,'project',{parentId:'folder'});assert.deepEqual(nested.groups.find(g=>g.id==='project'),{id:'project',name:'Project',projectKey:'p',agentIds:['chat'],parentId:'folder'});
 const promoted=relocateGroup(nested,'project',{parentId:null,topLevel:true,siblingId:'folder',position:'before'});assert.equal(promoted.groups[0].id,'project');assert.equal(promoted.groups[0].topLevel,true);assert.equal(promoted.groups[0].parentId,undefined);
});

test('project display membership includes native conversations without overriding explicit moves',()=>{
 const {withProjectMembers}=moduleObject.exports;
 const state={mode:'folders',groups:[{id:'p',name:'Star',projectKey:'project',agentIds:['extra']},{id:'f',name:'Folder',agentIds:['moved']}],ungroupedOrder:[]};
 const agents=['native','moved','foreign','extra'].map(id=>({id,hostId:id==='foreign'?'remote':'local',workspace:{key:'w'}}));
 const result=withProjectMembers(state,'local',[{key:'project',workspaceKeys:['w']}],agents,[]);
 assert.deepEqual(result.groups[0].agentIds,['extra','native']);assert.deepEqual(state.groups[0].agentIds,['extra']);assert.equal(result.groups[1],state.groups[1]);
});
test('folders and projects can nest inside a top-level project while depth constraints remain',()=>{
 const {relocateGroup}=moduleObject.exports;const state={mode:'folders',groups:[{id:'p',name:'Star',projectKey:'project',agentIds:['chat']},{id:'f',name:'Folder',agentIds:[]}],ungroupedOrder:[]};
 const next=relocateGroup(state,'f',{parentId:'p'});assert.equal(next.groups.find(g=>g.id==='f').parentId,'p');assert.equal(relocateGroup(next,'p',{parentId:'f'}),next);
});
