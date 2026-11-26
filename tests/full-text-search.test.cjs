const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const ts=require('typescript');
const load=(file,imports)=>{const m={exports:{}};new Function('require','exports',ts.transpileModule(fs.readFileSync(require.resolve(file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText)(n=>imports[n]??require(n),m.exports);return m.exports;};
test('full-text entry opens Transcript Search with the query in Paseo\'s param.q route key',()=>{
  const links=[];const web=load('../client/web.ts',{'react-native':{Platform:{OS:'web'},Linking:{openURL:async url=>{links.push(url);}}}});
  const route=web.transcriptSearchPath('srv 1','a&b “x” #1');
  assert.equal(route,'/h/srv%201/plugin/transcript-search/surface/search?param.q=a%26b%20%E2%80%9Cx%E2%80%9D%20%231');
  assert.equal(new URL(route,'http://x').searchParams.get('param.q'),'a&b “x” #1');
  const pushed=[],events=[];Object.assign(globalThis,{history:{pushState:(_,__,url)=>pushed.push(url)},dispatchEvent:e=>events.push(e),PopStateEvent:class{constructor(type){this.type=type;}}});
  try{web.openPaseoPath(route);}finally{delete globalThis.history;delete globalThis.dispatchEvent;delete globalThis.PopStateEvent;}
  assert.deepEqual(pushed,[route]);assert.equal(events[0].type,'popstate');assert.deepEqual(links,[]);
  web.openPaseoPath(route);assert.deepEqual(links,['paseo://'+route]);
});
test('entry shows only when the host config enables transcript-search',()=>{
  const {pluginEnabled}=load('../server/plugins.ts',{});const dir=fs.mkdtempSync(path.join(os.tmpdir(),'folders-plugins-'));const config=path.join(dir,'config.json');
  try{
    fs.writeFileSync(config,JSON.stringify({plugins:{'transcript-search':{enabled:true},other:{enabled:false}}}));
    assert.equal(pluginEnabled('transcript-search',config),true);assert.equal(pluginEnabled('other',config),false);assert.equal(pluginEnabled('missing',config),false);
    fs.writeFileSync(config,'{broken');assert.equal(pluginEnabled('transcript-search',config),false);
    assert.equal(pluginEnabled('transcript-search',path.join(dir,'absent.json')),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
