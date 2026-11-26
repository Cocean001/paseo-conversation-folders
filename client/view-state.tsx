import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSettings } from '@getpaseo/plugin/client';
import { viewState } from '../shared/settings';

type State = { open: Record<string, boolean>; showAll: string[]; activeTab: string | null; titleLines: number | null };
const empty: State = { open: {}, showAll: [], activeTab: null, titleLines: null };
interface ViewApi {
  isOpen(key: string, fallback: boolean): boolean;
  setOpen(key: string, open: boolean): void;
  register(key: string, fallback: boolean): () => void;
  showAll(key: string): boolean;
  setShowAll(key: string, value: boolean): void;
  activeTab: string | null;
  setActiveTab(id: string | null): void;
  titleLines: number | null;
  setTitleLines(lines: number): void;
  collapsed: boolean;
  toggleCollapseAll(extra?: readonly string[]): void;
}
const Context = createContext<ViewApi | null>(null);

/** One owner for this device's fold state, so rows never race each other's settings revisions. */
export function ViewStateProvider({ children }: { children: ReactNode }) {
  const settings = useSettings(viewState);
  const latest = useRef(settings); latest.current = settings;
  const [state, setState] = useState<State | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const beforeCollapse = useRef<Record<string, boolean>>({});
  const branches = useRef(new Map<string, boolean>());
  const register = useRef((key: string, fallback: boolean) => { branches.current.set(key, fallback); return () => { branches.current.delete(key); }; }).current;
  const dirty = useRef(false);
  useEffect(() => { if (!state && settings.status === 'ready') setState(settings.values); }, [settings.status, state]);
  useEffect(() => {
    if (!dirty.current || !state) return;
    const timer = setTimeout(() => {
      const current = latest.current;
      // A stale revision (another tab on this device wrote) reloads; the next change writes this state again.
      if (current.status === 'ready') void current.save(state, current.revision).then(saved => { if (!saved) void current.reload(); }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [state]);
  const current = state ?? (settings.status === 'ready' ? settings.values : empty);
  const update = (change: (value: State) => State) => { dirty.current = true; setState(value => change(value ?? current)); };
  const api: ViewApi = {
    isOpen: (key, fallback) => current.open[key] ?? fallback,
    setOpen: (key, open) => update(value => ({ ...value, open: { ...value.open, [key]: open } })),
    register,
    showAll: key => current.showAll.includes(key),
    setShowAll: (key, show) => update(value => ({ ...value, showAll: show ? [...new Set([...value.showAll, key])] : value.showAll.filter(item => item !== key) })),
    activeTab: current.activeTab,
    setActiveTab: id => update(value => ({ ...value, activeTab: id })),
    titleLines: current.titleLines,
    setTitleLines: lines => update(value => ({ ...value, titleLines: lines })),
    collapsed,
    toggleCollapseAll: (extra = []) => {
      if (collapsed) update(value => ({ ...value, open: { ...beforeCollapse.current } }));
      else { beforeCollapse.current = { ...current.open }; update(value => ({ ...value, open: { ...value.open, ...Object.fromEntries([...branches.current.keys(), ...extra].map(key => [key, false])) } })); }
      setCollapsed(!collapsed);
    },
  };
  return <Context.Provider value={api}>{children}</Context.Provider>;
}

/** Open state of one tree branch on this device; branches register so "collapse all" can reach them. */
export function useBranchOpen(key: string, fallback = true): [boolean, (open: boolean) => void] {
  const api = useContext(Context);
  const [local, setLocal] = useState(fallback);
  useEffect(() => api?.register(key, fallback), [api?.register, key, fallback]);
  return api ? [api.isOpen(key, fallback), open => api.setOpen(key, open)] : [local, setLocal];
}
export function useViewState() { return useContext(Context); }
