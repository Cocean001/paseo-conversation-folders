import { defineRpc } from '@getpaseo/plugin';
import { z } from 'zod';
/** Permanent deletion uses the official CLI until the public agent handle exposes delete. */
export const deleteConversation = defineRpc({
  name: 'folders.delete-conversation',
  input: z.object({ hostId: z.string().min(1), agentId: z.string().min(1), confirmAgentId: z.string().min(1) }),
  output: z.object({ deleted: z.boolean() }),
});
