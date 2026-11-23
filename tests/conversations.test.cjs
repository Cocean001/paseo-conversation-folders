const { test }=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const mod={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync(require.resolve('../shared/conversations.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);
const {conversationOrder,matchesConversation,defaultConversationOptions:defaults}=mod.exports;
const agent=(id,title,createdAt,lastActivityAt,status='idle',requiresAttention=false,attentionReason=null)=>({id,hostId:'local',title,createdAt,lastActivityAt,status,requiresAttention,attentionReason});
const a=agent('a','Zeta','2026-01-01','2026-02-02');const b=agent('b','Alpha','2026-01-02','2026-02-01','running',true,'permission');
test('all sort modes honor direction and manual order',()=>{
 for(const [sortBy,sortDirection,expected] of [['activity','desc',['a','b']],['activity','asc',['b','a']],['created','desc',['b','a']],['title','asc',['b','a']],['title','desc',['a','b']],['manual','desc',['b','a']]])assert.deepEqual([a,b].sort(conversationOrder({...defaults,sortBy,sortDirection},['b','a'])).map(a=>a.id),expected);
});
test('status filters combine with case-insensitive title search',()=>{
 assert.equal(matchesConversation(a,{...defaults,search:' zEtA '}),true);assert.equal(matchesConversation(b,{...defaults,search:'Zeta'}),false);
 assert.equal(matchesConversation(a,{...defaults,filter:'running'}),false);assert.equal(matchesConversation(b,{...defaults,filter:'running'}),true);
 assert.equal(matchesConversation(b,{...defaults,filter:'attention',search:'ALP'}),true);assert.equal(matchesConversation(a,{...defaults,filter:'attention'}),false);
 assert.equal(matchesConversation({...a,status:'error'},{...defaults,filter:'errors'}),true);assert.equal(matchesConversation({...a,attentionReason:'error'},{...defaults,filter:'errors'}),true);
 assert.equal(matchesConversation({...a,status:'initializing'},{...defaults,filter:'running'}),true);
});

test('background helper agents never show as conversations',()=>{const base={id:'x',hostId:'h',title:'Codex run',status:'idle',createdAt:'',lastActivityAt:'',requiresAttention:false,attentionReason:null};assert.equal(matchesConversation({...base,background:true},defaults),false);assert.equal(matchesConversation(base,defaults),true);});

test('subtasks fold under a listed parent but search and status filters still find them',()=>{
 const child={...agent('c','Go-live checklist','2026-01-03','2026-02-03','closed',true,'finished'),parentAgent:{key:'local:p'}};
 const parents=new Set(['local:p']);
 assert.equal(matchesConversation(child,{...defaults,parents}),false);
 assert.equal(matchesConversation(child,{...defaults,parents:new Set()}),true);
 assert.equal(matchesConversation(child,{...defaults,parents,search:'go-live'}),true);
 assert.equal(matchesConversation(child,{...defaults,parents,filter:'attention'}),true);
});
