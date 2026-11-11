const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../client/visuals.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const jsx = (type, props) => ({ type, props });
const mod = { exports: {} };
new Function('require', 'exports', source)(name => ({ react: {}, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { View: 'View', ActivityIndicator: 'Spinner' }, '@getpaseo/plugin/client/ui': {} })[name], mod.exports);
const theme = { colors: { accent: 'blue', foregroundMuted: 'gray', statusDanger: 'red', statusWarning: 'yellow', statusSuccess:'green' } };
test('busy, failure, permission and completion states have distinct visible indicators', () => {
  const render = state => mod.exports.StatusMark({ state, theme });
  for (const state of ['running', 'initializing', 'connecting']) assert.equal(render(state).props.children.type, mod.exports.LoadingMark);
  assert.equal(render('error').props.children.props.color, 'red');
  assert.equal(render('permission').props.children.props.color, 'yellow');
  assert.equal(render('finished').props.children.props.style.backgroundColor, 'green');
  assert.equal(render('finished').props.accessibilityLabel, 'Completed, read');
  assert.equal(render('updated').props.children.props.style.backgroundColor, 'blue');
  assert.equal(render('updated').props.accessibilityLabel, 'Unread update');
  assert.equal(render('idle').props.children.props.style.opacity, 0.35);
});

test('button feedback responds to hover and focus but ignores disabled interactions',()=>{
 let cursor=0;const states=[];const jsx=(type,props)=>({type,props});const result={exports:{}};
 const imports={react:{useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=v;}];}},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{Pressable:'Pressable',Platform:{OS:'web'}},'@getpaseo/plugin/client/ui':{}};
 new Function('require','exports',source)(name=>imports[name],result.exports);
 const buttonTheme={colors:{surface1:'hover',surface2:'pressed',accent:'focus',foregroundMuted:'keyboard'}};
 const render=disabled=>{cursor=0;return result.exports.FeedbackPressable({theme:buttonTheme,disabled,style:{width:32}});};
 const feedback=(node,pressed=false)=>node.props.style({pressed}).filter(Boolean);
 let node=render(false);assert.ok(!feedback(node).some(s=>s.backgroundColor));node.props.onFocus({target:{matches:()=>false}});node=render(false);assert.ok(!feedback(node).some(s=>s.outlineStyle==='solid'));node.props.onHoverIn({});node=render(false);assert.ok(feedback(node).some(s=>s.backgroundColor==='hover'));assert.ok(feedback(node,true).some(s=>s.backgroundColor==='pressed'));
 node.props.onHoverOut({});node.props.onFocus({target:{matches:()=>true}});node=render(false);assert.ok(feedback(node).some(s=>s.outlineColor==='keyboard'));
 node=render(true);assert.ok(!feedback(node,true).some(s=>s.backgroundColor||s.outlineColor));
});

test('desktop more action appears on row hover or keyboard focus, while compact keeps it visible',()=>{
 let cursor=0;const states=[];const jsx=(type,props)=>({type,props});const result={exports:{}};
 const imports={react:{useEffect(){},useRef(value){return {current:value}},useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=v;}];}},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Animated:{View:'AnimatedView',Value:class{constructor(value){this.value=value}}},Platform:{OS:'web'}},'@getpaseo/plugin/client/ui':{}};
 new Function('require','exports',source)(name=>imports[name],result.exports);
 const render=compact=>{cursor=0;return result.exports.ActionRow({compact,children:'label',action:'more'});};
 const opacity=node=>node.props.children[2].props.style.opacity.value;
 let node=render(false);assert.equal(opacity(node),0);node.props.onPointerEnter({nativeEvent:{pointerType:'mouse'}});node=render(false);assert.equal(opacity(node),1);
 node.props.onPointerLeave();node=render(false);assert.equal(opacity(node),0);node.props.onFocus({target:{matches:()=>true}});node=render(false);assert.equal(opacity(node),1);node.props.onBlur({currentTarget:{contains:()=>false},relatedTarget:null});node=render(false);assert.equal(opacity(node),0);
 assert.equal(opacity(render(true)),1);
});

test('branch busy replaces custom icon and collapsed updates badge the original icon',()=>{
 const render=(state,open)=>mod.exports.BranchIcon({state,hasUpdates:true,open,icon:'star',theme});
 const busy=render('running',true);assert.equal(busy.props.children[0].props.state,'running');
 const collapsed=render('updated',false);assert.equal(collapsed.props.children[0].props.name,'star');assert.equal(collapsed.props.children[1].props.accessibilityLabel,'Updates in collapsed group');assert.equal(collapsed.props.children[1].props.style.backgroundColor,'green');
 assert.equal(render('updated',true).props.children[1],false);
});
