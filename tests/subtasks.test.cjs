const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync(require.resolve('../shared/status.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(mod.exports);
const { quietSubtask } = mod.exports;
const state = (status, requiresAttention = false, attentionReason = null, parentAgent = { key: 'p' }) => ({ status, requiresAttention, attentionReason, parentAgent });

test('only subtasks that need the user surface outside their parent', () => {
  assert.equal(quietSubtask(state('closed', true, 'finished')), true);
  assert.equal(quietSubtask(state('running')), true);
  assert.equal(quietSubtask(state('idle', true, 'permission')), false);
  assert.equal(quietSubtask(state('error')), true);
  assert.equal(quietSubtask(state('closed', true, 'finished', null)), false);
});
