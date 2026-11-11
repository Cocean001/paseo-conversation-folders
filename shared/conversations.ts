/** Presentation-only query policy shared by manual and automatic trees. */
export type SortBy = 'activity' | 'created' | 'title' | 'manual';
export type ConversationFilter = 'all' | 'running' | 'attention' | 'errors';
export interface ConversationOptions { members?: readonly {hostId:string;agentId:string}[]; loadingColor?: string; collapseVersion?: number; allCollapsed?: boolean; freshFolderId?: string; loadingEffect?: 'spinner' | 'orbit' | 'pulse' | 'dots' | 'bars'; sortBy: SortBy; sortDirection: 'asc' | 'desc'; filter: ConversationFilter; search: string; workspaceKeys?: readonly string[] }
export interface ConversationSnapshot { id: string; hostId: string; title: string | null; status: string; createdAt: string; lastActivityAt: string; requiresAttention: boolean; attentionReason: string | null; workspace?: { key: string } }
export const defaultConversationOptions: ConversationOptions = { sortBy: 'activity', sortDirection: 'desc', filter: 'all', search: '' };
export function matchesConversation(agent: ConversationSnapshot, options: ConversationOptions): boolean {
  if (options.members && !options.members.some(member => member.hostId === agent.hostId && member.agentId === agent.id)) return false;
  if (options.workspaceKeys && (!agent.workspace || !options.workspaceKeys.includes(agent.workspace.key))) return false;
  if (options.search.trim() && !(agent.title || 'Untitled conversation').toLocaleLowerCase().includes(options.search.trim().toLocaleLowerCase())) return false;
  if (options.filter === 'running') return agent.status === 'running' || agent.status === 'initializing';
  if (options.filter === 'attention') return agent.requiresAttention;
  if (options.filter === 'errors') return agent.status === 'error' || agent.attentionReason === 'error';
  return true;
}
export function conversationOrder(options: ConversationOptions, order: readonly string[] = [], ownerHost?: string) {
  const ranks = new Map(order.map((id, index) => [id, index]));
  return (a: ConversationSnapshot, b: ConversationSnapshot): number => {
    if (options.sortBy === 'manual') {
      const rankA = ranks.get(ownerHost ? (ownerHost === a.hostId ? a.id : `host-agent:${JSON.stringify([a.hostId, a.id])}`) : a.id) ?? Number.MAX_SAFE_INTEGER, rankB = ranks.get(ownerHost ? (ownerHost === b.hostId ? b.id : `host-agent:${JSON.stringify([b.hostId, b.id])}`) : b.id) ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return a.id.localeCompare(b.id);
    }
    const field = options.sortBy === 'title' ? 'title' : options.sortBy === 'created' ? 'createdAt' : 'lastActivityAt';
    const compared = (a[field] || '').localeCompare(b[field] || '', undefined, { numeric: true, sensitivity: 'base' });
    return (options.sortDirection === 'desc' ? -compared : compared) || a.id.localeCompare(b.id);
  };
}
