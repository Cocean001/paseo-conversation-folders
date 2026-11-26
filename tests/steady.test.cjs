const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

let frozen = false;
const refs = [];
let cursor = 0;
const react = {
  createContext: value => ({ value }), useContext: () => frozen, useState: value => [value, () => {}], useEffect() {},
  useRef: value => { const i = cursor++; if (!(i in refs)) refs[i] = { current: value }; return refs[i]; },
};
const mod = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(require.resolve('../client/steady.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
new Function('require', 'exports', code)(name => ({ react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) } })[name], mod.exports);
const render = list => { cursor = 0; return mod.exports.useSteadyList(list); };

test('during a drag a list keeps the order and members it had when the drag began, then follows live data again', () => {
  assert.deepEqual(render(['a', 'b', 'c']), ['a', 'b', 'c']);
  frozen = true;
  assert.deepEqual(render(['c', 'a']), ['a', 'b', 'c']);
  frozen = false;
  assert.deepEqual(render(['c', 'a']), ['c', 'a']);
});
