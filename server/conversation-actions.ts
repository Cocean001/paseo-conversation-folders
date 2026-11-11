/// <reference types="node" />
import { execFile } from 'node:child_process';
import process from 'node:process';
import type { PluginHandlerContext } from '@getpaseo/plugin/server';

export async function deleteConfirmedConversation(input: {hostId:string; agentId:string; confirmAgentId:string}, {paseo}: PluginHandlerContext) {
  if (input.agentId !== input.confirmAgentId) throw new Error('Confirm the exact conversation before deleting.');
  const directory = await paseo.hosts.list();
  if (directory.self.serverId !== input.hostId) throw new Error('Permanent deletion is available on the plugin’s own host. Use the source host’s native conversation menu for this remote conversation.');
  const found = await paseo.agents.ref(input.agentId).refresh();
  if (!found || found.agent.id !== input.agentId) throw new Error('This conversation is no longer available.');
  // Pass an exact, fetched ID as a separate argv element; never use shell text or ID prefixes.
  const home = process.env.PASEO_HOME;
  if (!home) throw new Error('The daemon did not expose its home. Use the native conversation menu to delete this conversation.');
  await new Promise<void>((resolve,reject) => execFile('paseo', ['--home',home,'agent','delete',input.agentId,'--json'], {timeout:30000,maxBuffer:64*1024,env:{...process.env,PASEO_HOST:undefined,PASEO_AGENT_ID:undefined,PASEO_WORKSPACE_ID:undefined}}, error => { if(error) reject(new Error('Could not delete conversation through the Paseo CLI. Check that the CLI is available on the source host.')); else resolve(); }));
  return {deleted:true};
}
