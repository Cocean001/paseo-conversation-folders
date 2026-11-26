import { defineRpc } from '@getpaseo/plugin';
import { z } from 'zod';
export const hostContext = defineRpc({ name: 'folders.host-context', input: z.object({}), output: z.object({ hostId: z.string() }) });
/** Whether the host runs the Transcript Search plugin, so the sidebar only offers full-text search when its screen exists. */
export const transcriptSearch = defineRpc({ name: 'folders.transcript-search', input: z.object({}), output: z.object({ enabled: z.boolean() }) });
