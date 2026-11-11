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
