import { defineRpc } from '@getpaseo/plugin';
import { z } from 'zod';
export const hostContext = defineRpc({ name: 'folders.host-context', input: z.object({}), output: z.object({ hostId: z.string() }) });
