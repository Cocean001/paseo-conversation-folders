import { defineRpc } from '@getpaseo/plugin';
import { z } from 'zod';
/** Permanent deletion uses the official CLI until the public agent handle exposes delete. */
export const deleteConversation = defineRpc({
  name: 'folders.delete-conversation',
  input: z.object({ hostId: z.string().min(1), agentId: z.string().min(1), confirmAgentId: z.string().min(1) }),
  output: z.object({ deleted: z.boolean() }),
});

/** Exact source-host conversation rename, until the public agent handle exposes a title setter. */
export const renameConversation = defineRpc({
  name: 'folders.rename-conversation',
  input: z.object({ hostId: z.string().min(1), agentId: z.string().min(1), title: z.string().trim().min(1).max(120) }),
  output: z.object({ renamed: z.boolean(), title: z.string() }),
});
