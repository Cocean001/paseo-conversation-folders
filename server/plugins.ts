/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

/** Whether the daemon's config.json enables plugin `id`. An unreadable config hides the optional entry instead of failing the sidebar. */
export function pluginEnabled(id: string, configPath = path.join(process.env.PASEO_HOME || path.join(homedir(), '.paseo'), 'config.json')): boolean {
  try { return JSON.parse(readFileSync(configPath, 'utf8')).plugins?.[id]?.enabled === true; } catch { return false; }
}
