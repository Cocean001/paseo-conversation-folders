const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const nodePath = require('node:path');
const ts = require('typescript');

function load({ platform, argv1, exists }) {
  const process = { platform, argv: ['Paseo.exe', argv1], execPath: 'D:\\Paseo\\Paseo.exe', env: { PASEO_HOME: 'C:\\home' } };
  const calls = [];
  const imports = {
    'node:process': { default: process },
    'node:path': { default: nodePath.win32 },
    'node:fs': { existsSync: (file) => exists(file) },
    'node:child_process': { execFile(file, args, options, callback) { calls.push({ file, args, options }); callback(null); } },
  };
  const source = fs.readFileSync(require.resolve('../server/conversation-actions.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'exports', code)((name) => imports[name], mod.exports);
  return { mod: mod.exports, calls };
}

const bundled = 'D:\\Paseo\\resources\\app.asar\\node_modules\\@getpaseo\\server\\dist\\server\\server\\plugins\\plugin-process.js';
const cli = 'D:\\Paseo\\resources\\app.asar\\node_modules\\@getpaseo\\cli\\dist\\index.js';

test('Windows runs the bundled CLI with the plugin runtime, no shell', () => {
  const { mod } = load({ platform: 'win32', argv1: bundled, exists: (file) => file === cli });
  assert.deepEqual(mod.paseoCommand(), { file: 'D:\\Paseo\\Paseo.exe', prefix: [cli], env: { ELECTRON_RUN_AS_NODE: '1' } });
});

test('Windows without the bundled CLI and other platforms keep plain paseo', () => {
  assert.equal(load({ platform: 'win32', argv1: bundled, exists: () => false }).mod.paseoCommand().file, 'paseo');
  assert.equal(load({ platform: 'win32', argv1: 'C:\\x\\other.js', exists: () => true }).mod.paseoCommand().file, 'paseo');
  assert.equal(load({ platform: 'darwin', argv1: bundled, exists: () => true }).mod.paseoCommand().file, 'paseo');
});
