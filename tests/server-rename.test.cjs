const {test}=require('node:test');const assert=require('node:assert/strict');const ts=require('typescript');const fs=require('node:fs');
function harness({remote=false,missing=false,mismatch=false,cliError=false}={}){
 const calls=[];let title='Before';const process={env:{PASEO_HOME:'/demo',PASEO_HOST:'inherited',PASEO_AGENT_ID:'context',PASEO_WORKSPACE_ID:'context'}};
 const imports={'node:process':{default:process},'node:child_process':{execFile(command,args,options,callback){calls.push({command,args,options});if(!cliError)title=args[args.indexOf('--name')+1];callback(cliError?Error('failed'):null)}}};
 const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(require.resolve('../server/conversation-actions.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;new Function('require','exports',code)(name=>imports[name],mod.exports);
 const context={paseo:{hosts:{list:async()=>({self:{serverId:remote?'other':'local'}})},agents:{ref:id=>({refresh:async()=>missing?null:{agent:{id,title:mismatch?'Wrong':title}}})}}};
 return {calls,run:input=>mod.exports.renameSourceConversation(input,context)};
}
const input={hostId:'local',agentId:'exact-id',title:'After'};
test('rename uses exact ID, argv and daemon home, and verifies persisted title',async()=>{const h=harness();assert.deepEqual(await h.run(input),{renamed:true,title:'After'});assert.deepEqual(h.calls[0].args,['--home','/demo','agent','update','exact-id','--name','After','--json']);assert.equal(h.calls[0].options.env.PASEO_HOST,undefined);assert.equal(h.calls[0].options.env.PASEO_AGENT_ID,undefined);assert.equal(h.calls[0].options.env.PASEO_WORKSPACE_ID,undefined)});
test('rename rejects remote hosts and missing conversations before invoking CLI',async()=>{for(const options of [{remote:true},{missing:true}]){const h=harness(options);await assert.rejects(h.run(input));assert.equal(h.calls.length,0)}});
test('rename reports CLI and verification failures instead of claiming success',async()=>{await assert.rejects(harness({cliError:true}).run(input),/Could not rename/);await assert.rejects(harness({mismatch:true}).run(input),/did not confirm/);await assert.rejects(harness().run({...input,title:'  '}),/Enter a conversation name/)});
