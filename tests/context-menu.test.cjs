const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync(require.resolve('../client/context-menu.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function harness(){
 let cursor=0,states=[],closed=0,chosen=0,focused=[];
 const jsx=(type,props)=>({type,props});
 const imports={react:{useEffect(){},useRef(value){const i=cursor++;if(!(i in states))states[i]={current:value};return states[i];}},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Text:'Text',Modal:'Modal',Pressable:'Pressable',Animated:{View:'AnimatedView'},useWindowDimensions:()=>({width:390,height:800})},'./visuals':{FeedbackPressable:'Button',useMotion:()=>1}};
 const mod={exports:{}};new Function('require','exports',source)(name=>imports[name],mod.exports);
 const actions=[{id:'rename',label:'Rename',onSelect(){chosen++;}},{id:'disabled',label:'Unavailable',disabled:true,onSelect(){}},{id:'collapse',label:'Collapse',onSelect(){}}];
 cursor=0;const tree=mod.exports.ContextMenu({anchor:{x:388,y:799},actions,close(){closed++;},view:{layout:{compact:false},theme:{colors:{}}}});
 const body=tree.props.children, menu=body.props.children[1],items=menu.props.children;
 items.forEach((item,i)=>item.props.focusRef({focus(){focused.push(i);}}));
 return{tree,body,menu,items,focused,closed:()=>closed,chosen:()=>chosen};
}
test('context menu clamps to viewport and keyboard skips disabled actions',()=>{
 const h=harness();assert.ok(h.menu.props.style.left+208<=382);assert.ok(h.menu.props.style.top+100<=792);
 h.tree.props.onShow();assert.deepEqual(h.focused,[0]);
 h.body.props.onKeyDown({key:'ArrowDown',preventDefault(){},stopPropagation(){}});assert.deepEqual(h.focused,[0,2]);
 h.body.props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(h.closed(),1);
});
test('selecting a context action closes menu before executing action',()=>{
 const h=harness();h.items[0].props.onPress();assert.equal(h.closed(),1);assert.equal(h.chosen(),1);assert.equal(h.items[1].props.disabled,true);
});
