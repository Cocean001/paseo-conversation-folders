const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
test('registers the conversation folders sidebar view', () => {
  const source = fs.readFileSync(require.resolve('../index.client.tsx'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} }, registrations = [], removed = [];
  new Function('require', 'exports', code)(name => { assert.equal(name, './client/sidebar'); return { FolderSidebar: 'Sidebar' }; }, mod.exports);
  const client = { addSidebarView: contribution => { registrations.push(contribution); return () => removed.push(contribution.id); } };
  const cleanup = mod.exports.default(client);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].id, 'folders');
  assert.equal(registrations[0].Component, 'Sidebar');
  cleanup(); assert.deepEqual(removed, ['folders']);
});
