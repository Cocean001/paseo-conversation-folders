const { test }=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const mod={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync(require.resolve('../shared/conversations.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports);
const {conversationOrder,matchesConversation,shownTitle,defaultConversationOptions:defaults}=mod.exports;
const agent=(id,title,createdAt,lastActivityAt,status='idle',requiresAttention=false,attentionReason=null)=>({id,hostId:'local',title,createdAt,lastActivityAt,status,requiresAttention,attentionReason});
const a=agent('a','Zeta','2026-01-01','2026-02-02');const b=agent('b','Alpha','2026-01-02','2026-02-01','running',true,'permission');
test('all sort modes honor direction and manual order',()=>{
 for(const [sortBy,sortDirection,expected] of [['activity','desc',['b','a']],['activity','asc',['a','b']],['created','desc',['b','a']],['title','asc',['b','a']],['title','desc',['a','b']],['manual','desc',['b','a']]])assert.deepEqual([a,b].sort(conversationOrder({...defaults,sortBy,sortDirection},['b','a'])).map(a=>a.id),expected);
});
test('running conversations stay above the rest and keep creation order while their activity moves',()=>{
 const r1=agent('r1','One','2026-03-01','2026-03-05T10:00:01','running'),r2=agent('r2','Two','2026-03-02','2026-03-05T10:00:00','running'),done=agent('d','Done','2026-03-03','2026-03-05T10:00:02');
 const order=list=>list.sort(conversationOrder(defaults)).map(x=>x.id);
 assert.deepEqual(order([r1,r2,done]),['r2','r1','d']);
 r1.lastActivityAt='2026-03-05T10:00:09';assert.deepEqual(order([done,r2,r1]),['r2','r1','d']);
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

test('a pinned conversation leaves the lists below while search and status filters still find it',()=>{
 const item=agent('x','Release plan','2026-01-03','2026-02-03','closed',false,null);
 const pinned=new Set([item.hostId+':'+item.id]);
 assert.equal(matchesConversation(item,{...defaults,pinned}),false);
 assert.equal(matchesConversation(item,{...defaults,pinned,search:'release'}),true);
 assert.equal(matchesConversation(item,{...defaults,pinned:new Set()}),true);
});

test('titles drop a leading pasted session id for display only',()=>{
 assert.equal(shownTitle('c9096434-8a5b-488e-af07-10ddf18d4032 关于这个 paseo 对话'),'关于这个 paseo 对话');
 assert.equal(shownTitle('01a1c024-4d85-7fa2-8f53-7a4419ca6c0c，详细看一下'),'详细看一下');
 assert.equal(shownTitle('看一下 c9096434-8a5b-488e-af07-10ddf18d4032'),'看一下 c9096434-8a5b-488e-af07-10ddf18d4032');
 assert.equal(shownTitle('c9096434-8a5b-488e-af07-10ddf18d4032'),'c9096434-8a5b-488e-af07-10ddf18d4032');
 assert.equal(matchesConversation({id:'x',hostId:'local',title:'c9096434-8a5b-488e-af07-10ddf18d4032 关于',createdAt:'',lastActivityAt:'',status:'idle',requiresAttention:false,attentionReason:null},{...defaults,search:'c9096434'}),true);
});
