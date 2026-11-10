import { defineSettings } from '@getpaseo/plugin';
import { z } from 'zod';
export const organization = defineSettings({
  id: 'organization', scope: 'host', version: 1,
  schema: z.object({
    mode: z.enum(['folders', 'dividers']).default('folders'),
    groups: z.array(z.object({ id: z.string(), name: z.string().trim().min(1).max(60), agentIds: z.array(z.string()) })).default([]),
    ungroupedOrder: z.array(z.string()).default([]),
  }),
});

// Additional hosts are namespaced inside this installation; legacy groups stay untouched.
export const hostOrganizations = defineSettings({
  id: 'host-organizations', scope: 'host', version: 1,
  schema: z.object({ hosts: z.record(z.string(), organization.schema).default({}) }),
});
