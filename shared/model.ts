/** Pure immutable operations. No agent or workspace is modified or deleted. */
export interface Group { id: string; name: string; agentIds: string[] }
export interface Organization { mode: 'folders' | 'dividers'; groups: Group[]; ungroupedOrder: string[] }
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
  return { ...state, groups: state.groups.filter(g => g.id !== id), ungroupedOrder: [...state.ungroupedOrder, ...group.agentIds.filter(id => !state.ungroupedOrder.includes(id))] };
}
export function orderedIds(ids: string[], order: string[]): string[] {
  const available = new Set(ids);
  return [...new Set([...order.filter(id => available.has(id)), ...ids])];
}
