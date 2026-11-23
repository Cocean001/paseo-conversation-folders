import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * While a row is dragged, lists keep the order and members they had when the drag began, so live
 * activity (running conversations re-sorting, In progress gaining or losing rows) never moves rows
 * under the pointer. Row contents stay live; only positions hold until the drag ends.
 */
const Frozen = createContext(false);
const Control = createContext<((dragging: boolean) => void) | null>(null);

type Listener = (event: { buttons?: number }) => void;
export function SteadyProvider({ children }: { children: ReactNode }) {
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    const target = globalThis as unknown as { addEventListener?(type: string, handler: Listener): void; removeEventListener?(type: string, handler: Listener): void };
    if (!frozen || !target.addEventListener) return;
    // A drag whose source row left the page never reports its end; the first plain pointer move afterwards does.
    const release: Listener = event => { if (!event.buttons) setFrozen(false); };
    target.addEventListener('mousemove', release);
    return () => target.removeEventListener?.('mousemove', release);
  }, [frozen]);
  return <Control.Provider value={setFrozen}><Frozen.Provider value={frozen}>{children}</Frozen.Provider></Control.Provider>;
}

/** Drag sources report start and end here. */
export const useSteadyControl = () => useContext(Control);

/** The live list, or while a drag is in progress, the list as it was when the drag began. */
export function useSteadyList<T>(list: readonly T[]): readonly T[] {
  const frozen = useContext(Frozen);
  const kept = useRef(list);
  if (!frozen) kept.current = list;
  return kept.current;
}
