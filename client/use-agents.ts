import { usePaseo } from '@getpaseo/plugin/client';
import { useEffect, useState } from 'react';
export interface Conversation { workspaceId?: string; id: string; title: string | null; status: string; lastActivityAt?: string; cwd: string }
export function useConversations() {
  const paseo = usePaseo();
  const [agents, setAgents] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const lifetime = new AbortController();
    const directory = new Map<string, Conversation>();
    let generation = 0;
    const publish = () => setAgents([...directory.values()].sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '')));
    void paseo.agents.list({ subscribe: {}, signal: lifetime.signal, filter: { includeArchived: false, includeInternal: false }, page: { limit: 100 } }).then(({ subscription }) => {
      if (lifetime.signal.aborted) return;
      subscription.subscribe({
        snapshot: snapshot => {
          const current = ++generation;
          directory.clear();
          for (const { agent } of snapshot.entries) directory.set(agent.id, agent);
          publish(); setLoading(false); setError(null);
          // Fetch every page; do not silently omit older conversations.
          void (async () => {
            let page = snapshot.pageInfo;
            while (page.hasMore && page.nextCursor && !lifetime.signal.aborted && generation === current) {
              const next = await paseo.agents.list({ signal: lifetime.signal, filter: { includeArchived: false, includeInternal: false }, page: { limit: 100, cursor: page.nextCursor } });
              if (generation !== current || lifetime.signal.aborted) return;
              for (const { agent } of next.entries) if (!directory.has(agent.id)) directory.set(agent.id, agent);
              publish(); page = next.pageInfo;
            }
          })().catch(e => { if (!lifetime.signal.aborted) setError(String(e)); });
        },
        update: message => {
          if (message.type !== 'agent_update') return;
          const change = message.payload;
          if (change.kind === 'upsert') directory.set(change.agent.id, change.agent);
          else directory.delete(change.agentId);
          publish();
        },
        error: e => { if (!lifetime.signal.aborted) setError(String(e)); },
      });
    }).catch(e => { if (!lifetime.signal.aborted) { setError(String(e)); setLoading(false); } });
    return () => lifetime.abort();
  }, [paseo]);
  return { agents, error, loading };
}
