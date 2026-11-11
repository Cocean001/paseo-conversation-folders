/** Pure immutable operations. No agent or workspace is modified or deleted. */
export interface Group { id: string; parentId?: string; topLevel?: boolean; projectKey?: string; name: string; agentIds: string[] }
export interface FolderAssignment { hostId: string; agentId: string; folderHostId: string; groupId: string | null; beforeId?: string; beforeHostId?: string }
export interface Organization { assignments?: FolderAssignment[]; mode: 'folders' | 'dividers'; groups: Group[]; ungroupedOrder: string[] }
export function moveAgent(state: Organization, agentId: string, groupId: string | null, beforeId?: string): Organization {
  if (beforeId === agentId) return state;
  if (groupId !== null && !state.groups.some(g => g.id === groupId)) return state;
  const next = { ...state, groups: state.groups.map(g => ({ ...g, agentIds: g.agentIds.filter(id => id !== agentId) })), ungroupedOrder: state.ungroupedOrder.filter(id => id !== agentId) };
  const target = groupId === null ? next.ungroupedOrder : next.groups.find(g => g.id === groupId)!.agentIds;
  const index = beforeId ? target.indexOf(beforeId) : -1;
  target.splice(index < 0 ? target.length : index, 0, agentId);
  return next;
}
export function moveGroup(state: Organization, sourceId: string, beforeId: string): Organization {
  if (sourceId === beforeId) return state;
  const source = state.groups.find(g => g.id === sourceId);
  if (!source || !state.groups.some(g => g.id === beforeId)) return state;
  const groups = state.groups.filter(g => g.id !== sourceId);
  groups.splice(groups.findIndex(g => g.id === beforeId), 0, source);
  return { ...state, groups };
}
export function removeGroup(state: Organization, id: string): Organization {
  const group = state.groups.find(g => g.id === id);
  if (!group) return state;
  return { ...state, groups: state.groups.filter(g => g.id !== id).map(g => g.parentId === id ? { ...g, parentId: undefined } : g), ungroupedOrder: [...state.ungroupedOrder, ...group.agentIds.filter(id => !state.ungroupedOrder.includes(id))] };
}
export function orderedIds(ids: string[], order: string[]): string[] {
  const available = new Set(ids);
  return [...new Set([...order.filter(id => available.has(id)), ...ids])];
}

/** Legacy IDs belong to the folder owner; cross-host IDs carry an explicit host. */
export function memberId(ownerHost: string, hostId: string, agentId: string): string {
  return ownerHost === hostId ? agentId : `host-agent:${JSON.stringify([hostId, agentId])}`;
}
export function memberRef(ownerHost: string, value: string): { hostId: string; agentId: string } {
  if (value.startsWith('host-agent:')) {
    try { const pair = JSON.parse(value.slice(11)); if (Array.isArray(pair) && pair.length === 2 && pair.every(part => typeof part === 'string')) return { hostId: pair[0], agentId: pair[1] }; } catch { /* retain an old literal ID */ }
  }
  return { hostId: ownerHost, agentId: value };
}
export function containsMember(ids: readonly string[], ownerHost: string, hostId: string, agentId: string): boolean {
  return ids.some(value => { const member = memberRef(ownerHost, value); return member.hostId === hostId && member.agentId === agentId; });
}

/** One installation stores cross-host organization overrides, without touching agents. */
export function applyAssignments(state: Organization, folderHostId: string, assignments: readonly FolderAssignment[]): Organization {
  let next = state;
  for (const assignment of assignments) {
    const value = memberId(folderHostId, assignment.hostId, assignment.agentId);
    const validTarget = assignment.groupId === null || (assignment.folderHostId === folderHostId && state.groups.some(group => group.id === assignment.groupId));
    // Overrides referencing a deleted destination are ignored, restoring original membership.
    if (!validTarget && assignment.folderHostId === folderHostId) continue;
    next = { ...next, groups: next.groups.map(group => ({ ...group, agentIds: group.agentIds.filter(id => id !== value) })), ungroupedOrder: next.ungroupedOrder.filter(id => id !== value) };
    if (assignment.folderHostId !== folderHostId) continue;
    next = moveAgent(next, value, assignment.groupId, assignment.beforeId ? memberId(folderHostId, assignment.beforeHostId ?? folderHostId, assignment.beforeId) : undefined);
  }
  return next;
}
