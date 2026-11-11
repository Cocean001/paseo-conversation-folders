import { memberRef, type Organization } from './model';

export interface TabMember { hostId: string; agentId: string }
export interface SidebarTab { id: string; name: string; open: boolean; organization: Organization; hosts: Record<string, Organization>; members: TabMember[] }
export interface SidebarTabs { enabled: boolean; activeId: string; tabs: SidebarTab[] }
export const emptyOrganization = (): Organization => ({ mode: 'folders', groups: [], ungroupedOrder: [] });
export function createSidebarTab(state: SidebarTabs, id: string, name: string): SidebarTabs {
  const title = name.trim().slice(0, 40);
  if (!title || id === 'all' || state.tabs.some(tab => tab.id === id)) return state;
  return { ...state, enabled: true, activeId: id, tabs: [...state.tabs, { id, name: title, open: true, organization: emptyOrganization(), hosts: {}, members: [] }] };
}
export function closeSidebarTab(state: SidebarTabs, id: string): SidebarTabs {
  const index = state.tabs.findIndex(tab => tab.id === id && tab.open);
  if (index < 0) return state;
  const remaining = state.tabs.filter(tab => tab.open && tab.id !== id);
  const activeId = state.activeId === id ? (remaining[Math.max(0, state.tabs.filter(tab => tab.open).findIndex(tab => tab.id === id) - 1)]?.id ?? 'all') : state.activeId;
  return { ...state, activeId, tabs: state.tabs.map(tab => tab.id === id ? { ...tab, open: false } : tab) };
}
export function reopenSidebarTab(state: SidebarTabs, id: string): SidebarTabs {
  if (!state.tabs.some(tab => tab.id === id)) return state;
  return { ...state, enabled: true, activeId: id, tabs: state.tabs.map(tab => tab.id === id ? { ...tab, open: true } : tab) };
}
export function updateSidebarTab(state: SidebarTabs, id: string, patch: Partial<Omit<SidebarTab, 'id'>>): SidebarTabs {
  if (!state.tabs.some(tab => tab.id === id)) return state;
  return { ...state, tabs: state.tabs.map(tab => tab.id === id ? { ...tab, ...patch } : tab) };
}
const memberKey = (member: TabMember) => JSON.stringify([member.hostId, member.agentId]);
export function addTabMembers(tab: SidebarTab, members: readonly TabMember[]): TabMember[] {
  const unique = new Map([...tab.members, ...members].map(member => [memberKey(member), member]));
  return [...unique.values()];
}
/** Removing a chat from a tab also removes its saved folder/order overrides. */
export function selectTabMembers(tab: SidebarTab, members: readonly TabMember[], ownerHost: string): SidebarTab {
  const selected = new Set(members.map(memberKey));
  function prune(organization: Organization, hostId: string): Organization {
    const includes = (id: string) => selected.has(memberKey(memberRef(hostId, id)));
    return {
      ...organization,
      groups: organization.groups.map(group => ({ ...group, agentIds: group.agentIds.filter(includes) })),
      ungroupedOrder: organization.ungroupedOrder.filter(includes),
      ...(organization.assignments ? { assignments: organization.assignments.filter(assignment => selected.has(memberKey(assignment))) } : {}),
    };
  }
  return {
    ...tab,
    members: [...new Map(members.map(member => [memberKey(member), member])).values()],
    organization: prune(tab.organization, ownerHost),
    hosts: Object.fromEntries(Object.entries(tab.hosts).map(([hostId, organization]) => [hostId, prune(organization, hostId)])),
  };
}
