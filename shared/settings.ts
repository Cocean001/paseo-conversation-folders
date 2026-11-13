import { defineSettings } from '@getpaseo/plugin';
import { z } from 'zod';
export const organization = defineSettings({
  id: 'organization', scope: 'host', version: 1,
  schema: z.object({
    mode: z.enum(['folders', 'dividers']).default('folders'),
    groups: z.array(z.object({ id: z.string(), parentId: z.string().optional(), topLevel: z.boolean().optional(), projectKey: z.string().optional(), name: z.string().trim().min(1).max(60), agentIds: z.array(z.string()) })).default([]),
    ungroupedOrder: z.array(z.string()).default([]),
    assignments: z.array(z.object({ hostId: z.string(), agentId: z.string(), folderHostId: z.string(), groupId: z.string().nullable(), beforeId: z.string().optional(), beforeHostId: z.string().optional() })).optional(),
  }),
});

// Additional hosts are namespaced inside this installation; legacy groups stay untouched.
export const hostOrganizations = defineSettings({
  id: 'host-organizations', scope: 'host', version: 1,
  schema: z.object({ hosts: z.record(z.string(), organization.schema).default({}) }),
});

export const displayPreferences = defineSettings({
  id: 'display-preferences', scope: 'host', version: 1,
  schema: z.object({
    grouping: z.enum(['manual', 'server', 'project', 'server-project']).default('manual'),
    showServer: z.boolean().default(false),
    showTabs: z.boolean().default(true),
    tabStyle: z.enum(['full', 'compact', 'number']).default('full'),
    showCounts: z.boolean().default(true),
    multilineTitles: z.boolean().default(false),
    sortBy: z.enum(['activity', 'created', 'title', 'manual']).default('activity'),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
    loadingColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#4F86F7'),
    loadingEffect: z.enum(['spinner', 'orbit', 'pulse', 'dots', 'bars']).default('spinner'),
    showBackground: z.boolean().default(true),
    filter: z.enum(['all', 'running', 'attention', 'errors']).default('all'),
  }),
});

export const projectAppearance = defineSettings({
  id: 'project-appearance', scope: 'host', version: 1,
  schema: z.object({ projects: z.record(z.string(), z.object({
    name: z.string().trim().max(60),
    icon: z.string().min(1).max(80),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    image: z.string().max(180000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/).optional(),
  })).default({}) }),
});


export const sidebarTabs = defineSettings({
  id: 'sidebar-tabs', scope: 'host', version: 1,
  schema: z.object({
    enabled: z.boolean().default(true), activeId: z.string().default('all'),
    tabs: z.array(z.object({
      id: z.string().min(1), name: z.string().trim().min(1).max(40), open: z.boolean().default(true),
      organization: organization.schema,
      hosts: z.record(z.string(), organization.schema).default({}),
      members: z.array(z.object({hostId:z.string(),agentId:z.string()})).default([]),
    })).default([]),
  }),
});
