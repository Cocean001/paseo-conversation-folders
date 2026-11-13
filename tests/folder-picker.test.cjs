const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, requireModule) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(require.resolve(path), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('exports', 'require', code)(mod.exports, requireModule);
  return mod.exports;
}
const model = load('../shared/model.ts');
const { currentPickerTree } = load('../shared/folder-picker.ts', () => model);
function fixture(mode) {
  const groups = { local: [
    { id: 'folder', name: 'Work', agentIds: ['same'], topLevel: true },
    { id: 'child', name: 'Review', parentId: 'folder', agentIds: [model.memberId('local', 'remote', 'same')] },
    { id: 'placed', name: 'Saved project', projectKey: 'placed-project', agentIds: ['native'] },
  ], remote: [] };
  return { mode, targetHost: 'local', hosts: [{ serverId: 'local', label: 'Local' }, { serverId: 'remote', label: 'Remote' }], groupsForHost: host => groups[host],
    projects: [{ key: 'placed-project', title: 'Original name', hostId: 'local', workspaceKeys: ['workspace'] }, { key: 'other-project', title: 'Other project', hostId: 'remote', workspaceKeys: ['remote-workspace'] }],
    agents: [{ hostId: 'local', id: 'same', workspace: { key: 'workspace' } }, { hostId: 'remote', id: 'same', workspace: { key: 'remote-workspace' } }, { hostId: 'local', id: 'native', workspace: { key: 'workspace' } }, { hostId: 'local', id: 'unfiled', workspace: { key: 'extra' } }, { hostId: 'remote', id: 'free', workspace: { key: 'remote-workspace' } }],
  };
}
function flatten(nodes) { return nodes.flatMap(node => [node, ...flatten(node.children)]); }
test('current layout preserves folder nesting, placed project identity and equal IDs from separate hosts', () => {
  const nodes = currentPickerTree(fixture('server-project'));
  const all = flatten(nodes);
  assert.equal(nodes.find(node => node.title === 'Work').children[0].title, 'Review');
  assert.deepEqual(all.find(node => node.title === 'Work').members, [{ hostId: 'local', agentId: 'same' }]);
  assert.deepEqual(all.find(node => node.title === 'Review').members, [{ hostId: 'remote', agentId: 'same' }]);
  assert.equal(all.filter(node => node.projectKey === 'placed-project').length, 1);
  assert.equal(all.find(node => node.projectKey === 'placed-project').title, 'Saved project');
  assert.deepEqual(all.find(node => node.title === 'Other project').members, [{ hostId: 'remote', agentId: 'free' }]);
});
test('each grouping keeps assigned conversations in one location and preserves all visible members', () => {
  for (const mode of ['server', 'project', 'server-project']) {
    const nodes = currentPickerTree(fixture(mode));
    const members = flatten(nodes).flatMap(node => node.members).map(member => JSON.stringify([member.hostId, member.agentId]));
    assert.equal(members.length, new Set(members).size, mode);
    assert.ok(members.includes(JSON.stringify(['local', 'native'])), mode);
    assert.ok(members.includes(JSON.stringify(['remote', 'same'])), mode);
    assert.equal(nodes.some(node => node.icon === 'server'), mode !== 'project');
  }
});
test('manual view uses the active host and preserves unfiled and cross-host folder members', () => {
  const nodes = currentPickerTree(fixture('manual'));
  assert.deepEqual(nodes.map(node => node.title), ['Work', 'Saved project', 'Unfiled']);
  assert.deepEqual(nodes.at(-1).members, [{ hostId: 'local', agentId: 'unfiled' }]);
  assert.deepEqual(nodes[0].children[0].members, [{ hostId: 'remote', agentId: 'same' }]);
});
