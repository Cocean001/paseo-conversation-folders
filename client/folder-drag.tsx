import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import type { PluginSidebarViewProps } from '@getpaseo/plugin/client';
import { canRelocateGroup, type Group, type GroupPlacement } from '../shared/model';

export interface DragFolder { hostId: string; groupId: string; project?: Group }
export interface FolderDestination extends GroupPlacement { hostId: string; project?: Group }
const MIME = 'application/x-paseo-sidebar-folder';
interface Event {
  clientY: number; relatedTarget?: unknown;
  dataTransfer: { types: readonly string[]; effectAllowed: string; dropEffect: string; setData(type: string, data: string): void; getData(type: string): string };
  preventDefault(): void; stopPropagation(): void;
}
interface Node {
  parentElement?: Node | null; scrollHeight?: number; clientHeight?: number; scrollTop: number; setAttribute?(name:string,value:string): void; removeAttribute?(name:string): void; draggable: boolean; style: { opacity: string }; ownerDocument: Node;
  addEventListener(type: string, handler: (event: Event) => void): void;
  removeEventListener(type: string, handler: (event: Event) => void): void;
  contains(node: unknown): boolean; getBoundingClientRect(): { top: number; height: number; bottom: number };
}
const Context = createContext<{
  current: { current: DragFolder | null };
  groups(hostId: string): Group[];
  move(source: DragFolder, destination: FolderDestination): Promise<boolean>;
} | null>(null);
export function FolderDragProvider({ children, groups, move }: { children: ReactNode; groups(hostId: string): Group[]; move(source: DragFolder, destination: FolderDestination): Promise<boolean> }) {
  const current = useRef<DragFolder | null>(null);
  return <Context.Provider value={{ current, groups, move }}>{children}</Context.Provider>;
}
export function DragFolderRow({ source, children, disabled = false }: { source: DragFolder; children: ReactNode; disabled?: boolean }) {
  const context = useContext(Context), ref = useRef<View>(null);
  const sourceRef = useRef(source); sourceRef.current = source;
  useEffect(() => {
    const element = ref.current as unknown as Node | null;
    if (Platform.OS !== 'web' || disabled || !context || !element?.addEventListener) return;
    element.draggable = true;
    const end = () => { context.current.current = null; element.style.opacity = ''; element.removeAttribute?.('data-paseo-sidebar-dragging'); };
    const start = (event: Event) => {
      event.stopPropagation(); context.current.current = sourceRef.current;
      event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(MIME, JSON.stringify(sourceRef.current)); element.style.opacity = '0.5'; element.setAttribute?.('data-paseo-sidebar-dragging','true');
    };
    element.addEventListener('dragstart', start); element.addEventListener('dragend', end);
    return () => { element.removeEventListener('dragstart', start); element.removeEventListener('dragend', end); element.draggable = false; element.style.opacity = ''; element.removeAttribute?.('data-paseo-sidebar-dragging'); };
  }, [context, source.hostId, source.groupId, disabled]);
  return <View ref={ref} accessibilityHint="Drag into a folder, or to its top or bottom edge to reorder" style={{ minWidth: 0 }}>{children}</View>;
}
/** Row edges reorder; the center nests. Root targets promote back to the top level. */
export function FolderDropTarget({ hostId, group, root = false, topLevel = true, view, children, activate, insideOnly = false, anyHost = false }: { hostId: string; group?: Group; root?: boolean; topLevel?: boolean; view: PluginSidebarViewProps; children: ReactNode; activate?(): void; insideOnly?: boolean; anyHost?: boolean }) {
  const context = useContext(Context), ref = useRef<View>(null), pending = useRef(false);
  const activateRef = useRef(activate); activateRef.current = activate;
  const [over, setOver] = useState<'before' | 'after' | 'inside' | null>(null);
  useEffect(() => {
    const element = ref.current as unknown as Node | null;
    if (Platform.OS !== 'web' || !context || !element?.addEventListener) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { if (timer) clearTimeout(timer); timer = undefined; setOver(null); };
    const destination = (event: Event): FolderDestination | null => {
      const source = context.current.current;
      if (!source || pending.current || (!anyHost && source.hostId !== hostId) || !Array.from(event.dataTransfer.types).includes(MIME)) return null;
      const rect = element.getBoundingClientRect(), edge = Math.min(8, rect.height / 4);
      const position = root || insideOnly ? 'inside' : event.clientY < rect.top + edge ? 'before' : event.clientY > rect.bottom - edge ? 'after' : 'inside';
      const destinationHost = anyHost ? source.hostId : hostId;
      const placement: FolderDestination = root ? { hostId: destinationHost, parentId: null, topLevel } : position === 'inside' ? { hostId, parentId: group!.id } : { hostId, parentId: group!.parentId ?? null, topLevel: !!group!.topLevel, siblingId: group!.id, position };
      const groups = context.groups(destinationHost);
      const additions = [source.project, group?.projectKey ? group : undefined].filter((item): item is Group => !!item && !groups.some(existing => existing.id === item.id));
      const available = [...groups, ...additions.filter((item,index) => additions.findIndex(other => other.id === item.id) === index)];
      if (group?.projectKey) placement.project = group;
      return canRelocateGroup(available, source.groupId, placement) ? placement : null;
    };
    const enter = (event: Event) => {
      const next = destination(event);
      // Invalid folder drops must not bubble into an ancestor destination.
      if (!context.current.current || !Array.from(event.dataTransfer.types).includes(MIME)) return;
      event.stopPropagation();
      if (!next) { clear(); event.dataTransfer.dropEffect = 'none'; return; }
      event.preventDefault(); event.dataTransfer.dropEffect = 'move';
      let scroll = element.parentElement;
      while (scroll) { if ((scroll.scrollHeight ?? 0) > (scroll.clientHeight ?? 0) + 2) { const bounds = scroll.getBoundingClientRect(); if (event.clientY < bounds.top + 32) scroll.scrollTop -= 12; if (event.clientY > bounds.bottom - 32) scroll.scrollTop += 12; break; } scroll = scroll.parentElement; }
      const position = next.position ?? 'inside'; setOver(position);
      if (position === 'inside' && !timer) timer = setTimeout(() => activateRef.current?.(), 500);
      if (position !== 'inside' && timer) { clearTimeout(timer); timer = undefined; }
    };
    const leave = (event: Event) => { if (!element.contains(event.relatedTarget)) clear(); };
    const drop = (event: Event) => {
      const next = destination(event), source = context.current.current;
      if (!source || !Array.from(event.dataTransfer.types).includes(MIME)) return;
      event.stopPropagation(); clear();
      if (!next) return;
      event.preventDefault();
      try {
        const payload = JSON.parse(event.dataTransfer.getData(MIME));
        if (payload.hostId !== source.hostId || payload.groupId !== source.groupId) return;
        context.current.current = null; pending.current = true;
        void context.move(source, next).then(saved => { if (saved) activateRef.current?.(); }).catch(() => false).finally(() => { pending.current = false; });
      } catch { context.current.current = null; }
    };
    const handlers = [['dragenter', enter], ['dragover', enter], ['dragleave', leave], ['drop', drop]] as const;
    handlers.forEach(([type, handler]) => element.addEventListener(type, handler));
    element.ownerDocument?.addEventListener('dragend', clear); element.ownerDocument?.addEventListener('drop', clear);
    return () => { clear(); handlers.forEach(([type, handler]) => element.removeEventListener(type, handler)); element.ownerDocument?.removeEventListener('dragend', clear); element.ownerDocument?.removeEventListener('drop', clear); };
  }, [context, hostId, group?.id, group?.parentId, group?.topLevel, root, topLevel, insideOnly, anyHost]);
  const accent = view.theme.colors.accent || view.theme.colors.foregroundMuted;
  return <View ref={ref} style={{ minWidth: 0, position: 'relative' }}>
    {children}
    {over && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, ...(over === 'inside' ? { top: 0, bottom: 0, borderWidth: 1, borderRadius: 5, borderColor: accent, backgroundColor: view.theme.colors.surface1, opacity: 0.6 } : { height: 2, backgroundColor: accent, ...(over === 'before' ? { top: 0 } : { bottom: 0 }) }) }} />}
  </View>;
}
