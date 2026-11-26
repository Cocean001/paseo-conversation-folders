/// <reference types="node" />
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type { PluginHandlerContext } from '@getpaseo/plugin/server';

// On Windows `paseo` is a .cmd shim: execFile cannot start it without a shell, and a shell would parse the title.
// There, run the CLI bundled beside this plugin process with the same runtime, still without a shell.
export function paseoCommand(): { file: string; prefix: string[]; env: Record<string, string> } {
  if (process.platform !== 'win32') return { file: 'paseo', prefix: [], env: {} };
  const entry = process.argv[1] ?? '';
  const marker = `${path.sep}@getpaseo${path.sep}server${path.sep}`;
  const at = entry.lastIndexOf(marker);
  const cli = at >= 0 ? path.join(entry.slice(0, at), '@getpaseo', 'cli', 'dist', 'index.js') : '';
  // shortcut: only the desktop bundle layout is resolved; other Windows installs keep the plain `paseo` lookup.
  if (!cli || !existsSync(cli)) return { file: 'paseo', prefix: [], env: {} };
  return { file: process.execPath, prefix: [cli], env: { ELECTRON_RUN_AS_NODE: '1' } };
}

function runPaseo(args: string[], failure: string): Promise<void> {
  const command = paseoCommand();
  const env = { ...process.env, ...command.env, PASEO_HOST: undefined, PASEO_AGENT_ID: undefined, PASEO_WORKSPACE_ID: undefined };
  return new Promise<void>((resolve, reject) => execFile(command.file, [...command.prefix, ...args], { timeout: 30000, maxBuffer: 64 * 1024, windowsHide: true, env }, error => error ? reject(new Error(failure)) : resolve()));
}

export async function deleteConfirmedConversation(input: {hostId:string; agentId:string; confirmAgentId:string}, {paseo}: PluginHandlerContext) {
  if (input.agentId !== input.confirmAgentId) throw new Error('Confirm the exact conversation before deleting.');
  const directory = await paseo.hosts.list();
  if (directory.self.serverId !== input.hostId) throw new Error('Permanent deletion is available on the plugin’s own host. Use the source host’s native conversation menu for this remote conversation.');
  const found = await paseo.agents.ref(input.agentId).refresh();
  if (!found || found.agent.id !== input.agentId) throw new Error('This conversation is no longer available.');
  // Pass an exact, fetched ID as a separate argv element; never use shell text or ID prefixes.
  const home = process.env.PASEO_HOME;
  if (!home) throw new Error('The daemon did not expose its home. Use the native conversation menu to delete this conversation.');
  await runPaseo(['--home',home,'agent','delete',input.agentId,'--json'], 'Could not delete conversation through the Paseo CLI. Check that the CLI is available on the source host.');
  return {deleted:true};
}

export async function renameSourceConversation(input: {hostId:string;agentId:string;title:string}, {paseo}: PluginHandlerContext) {
  const title=input.title.trim();
  if(!title || title.length>120) throw new Error('Enter a conversation name between 1 and 120 characters.');
  const directory=await paseo.hosts.list();
  if(directory.self.serverId!==input.hostId) throw new Error('Rename this conversation using its source host’s native controls.');
  const found=await paseo.agents.ref(input.agentId).refresh();
  if(!found || found.agent.id!==input.agentId) throw new Error('This conversation is no longer available.');
  const home=process.env.PASEO_HOME;
  if(!home) throw new Error('The daemon did not expose its home. Use the native conversation menu to rename.');
  await runPaseo(['--home',home,'agent','update',input.agentId,'--name',title,'--json'], 'Could not rename conversation through the Paseo CLI. Check the source host connection.');
  const updated=await paseo.agents.ref(input.agentId).refresh();
  if(updated?.agent.title!==title) throw new Error('The host did not confirm the new conversation name. Try again.');
  return {renamed:true,title};
}
