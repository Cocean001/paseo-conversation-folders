export interface AgentStatus { status: string; requiresAttention: boolean; attentionReason: string | null }
/** Agent attention is the source of truth; workspace indicators can lag a completed turn. */
export function conversationState(agent: AgentStatus): string {
  if (agent.status === 'running' || agent.status === 'initializing') return 'running';
  if (agent.status === 'error' || agent.requiresAttention && agent.attentionReason === 'error') return 'error';
  if (agent.requiresAttention && agent.attentionReason === 'permission') return 'permission';
  if (agent.requiresAttention) return 'updated';
  return agent.status === 'idle' || agent.attentionReason === 'finished' ? 'finished' : 'idle';
}
export function aggregateStates(states: readonly string[]) {
  return { state: ['running','error','permission','updated'].find(state => states.includes(state)) ?? 'idle', hasUpdates: states.some(state => ['updated','permission','error'].includes(state)) };
}
