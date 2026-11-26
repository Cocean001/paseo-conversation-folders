import { createContext, useContext } from 'react';

/** Conversations pinned to the top of the sidebar, shared by every device on the host. */
export interface Pins {
  keys: ReadonlySet<string>;
  isPinned(ref: { hostId: string; id: string }): boolean;
  toggle(ref: { hostId: string; id: string }): Promise<boolean>;
}
export const pinKey = (hostId: string, agentId: string) => `${hostId}:${agentId}`;
export const PinsContext = createContext<Pins | null>(null);
export const usePins = () => useContext(PinsContext);
