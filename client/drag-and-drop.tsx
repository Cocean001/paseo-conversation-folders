import { createLayoutMotion, conversationMotionKey, type MotionElement } from './layout-motion';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import type { PluginSidebarViewProps } from '@getpaseo/plugin/client';
import { useTouchDrag } from './touch-drag';
import { useSteadyControl } from './steady';
/** `from` is the list the row sits in, so a drop back into that list can be told apart from a move. */
export interface DragConversation { hostId: string; agentId: string; from?: { hostId: string; groupId: string | null; projectKey?: string } }
export interface ConversationDestination { hostId: string; groupId: string | null; beforeId?: string; beforeHostId?: string; projectKey?: string; projectTitle?: string }
const MIME = 'application/x-paseo-conversation-folder';
interface Transfer { types: readonly string[]; effectAllowed: string; dropEffect: string; setData(type: string, data: string): void; getData(type: string): string }
interface DragEvent { dataTransfer: Transfer; clientY: number; relatedTarget?: unknown; preventDefault(): void; stopPropagation(): void }
interface Element { style: { opacity: string }; setAttribute?(name:string,value:string): void; removeAttribute?(name:string): void; draggable: boolean; addEventListener(type: string, handler: (event: DragEvent) => void): void; removeEventListener(type: string, handler: (event: DragEvent) => void): void; contains(node: unknown): boolean; parentElement: Element | null; scrollHeight: number; clientHeight: number; scrollTop: number; getBoundingClientRect(): { top: number; bottom: number } }
const DragContext = createContext<{ current: { current: DragConversation | null }; lit: { current: (() => void) | null }; move(source: DragConversation, destination: ConversationDestination): Promise<boolean>; motion?: ReturnType<typeof createLayoutMotion> } | null>(null);
export function ConversationDragProvider({ children, move }: { children: ReactNode; move(source: DragConversation, destination: ConversationDestination): Promise<boolean> }) {
  const current = useRef<DragConversation | null>(null);
  // The one drop marker currently shown; lighting another switches it off.
  const lit = useRef<(() => void) | null>(null);
  const motion = useRef<ReturnType<typeof createLayoutMotion> | null>(null);
  if (!motion.current) motion.current = createLayoutMotion();
  useEffect(() => () => motion.current?.cancel(), []);
  const animatedMove = async (source: DragConversation, destination: ConversationDestination) => {
    const before = motion.current!.capture();
    const saved = await move(source, destination);
    if (saved) motion.current!.finish(before, conversationMotionKey(source.hostId, source.agentId));
    else motion.current!.cancel();
    return saved;
  };
  return <DragContext.Provider value={{ current, lit, move: animatedMove, motion: motion.current }}>{children}</DragContext.Provider>;
}
export function DragConversationRow({ source, children }: { source: DragConversation; children: ReactNode }) {
  const context = useContext(DragContext);
  const node = useRef<View>(null);
  const touch = useTouchDrag();
  const [dragging, setDragging] = useState(false);
  const steady = useSteadyControl();
  useEffect(() => {
    if (Platform.OS !== 'web' || !context) return;
    const element = node.current as unknown as Element | null;
    if (!element?.addEventListener) return;
    const unregister = context.motion?.register(conversationMotionKey(source.hostId, source.agentId), element as unknown as MotionElement);
    // Phones drag through the touch engine; the browser drag API would fight the long press.
    if (touch) return unregister;
    element.draggable = true;
    const start = (event: DragEvent) => { context.current.current = source; event.stopPropagation(); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(MIME, JSON.stringify(source)); setDragging(true); steady?.(true); element.setAttribute?.('data-paseo-sidebar-dragging','true'); };
    const end = () => { context.current.current = null; setDragging(false); steady?.(false); element.removeAttribute?.('data-paseo-sidebar-dragging'); };
    element.addEventListener('dragstart', start); element.addEventListener('dragend', end);
    return () => { unregister?.(); element.removeEventListener('dragstart', start); element.removeEventListener('dragend', end); element.draggable = false; element.removeAttribute?.('data-paseo-sidebar-dragging'); };
  }, [context, source.hostId, source.agentId, touch, steady]);
  return <View ref={node} accessibilityHint="Drag to a folder or above another conversation to organize" style={{ minWidth: 0, ...(dragging ? { opacity: 0.5 } : {}) }}>{children}</View>;
}
export function ConversationDropTarget({ destination, children, view, activate }: { destination: ConversationDestination; children: ReactNode; view: PluginSidebarViewProps; activate?(): void }) {
  const context = useContext(DragContext);
  const node = useRef<View>(null);
  const [over, setOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const activateRef = useRef(activate); activateRef.current = activate;
  const takes = (source: DragConversation | null) => !saving && !!source && !!(destination.projectKey || destination.groupId !== null || source.hostId === destination.hostId) && !(source.agentId === destination.beforeId && source.hostId === (destination.beforeHostId ?? destination.hostId));
  const latest = useRef({ takes, destination }); latest.current = { takes, destination };
  const touch = useTouchDrag();
  useEffect(() => touch && context ? touch.register({
    node,
    show: position => setOver(!!position),
    resolve: source => source.kind === 'conversation' && latest.current.takes(source.value) ? { position: 'inside', commit: () => { setSaving(true); return context.move(source.value, latest.current.destination).finally(() => setSaving(false)); } } : null,
  }) : undefined, [touch, context]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !context) return;
    const element = node.current as unknown as Element | null;
    if (!element?.addEventListener) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { if (timer) clearTimeout(timer); timer = undefined; if (context.lit.current === clear) context.lit.current = null; setOver(false); };
    // A row inside a branch stops the event, so the branch never hears it leave: switch it off here.
    const light = () => { if (context.lit.current !== clear) { context.lit.current?.(); context.lit.current = clear; } setOver(true); };
    const accepts = (event: DragEvent) => takes(context.current.current) && Array.from(event.dataTransfer.types).includes(MIME);
    const enter = (event: DragEvent) => { if (!accepts(event)) return; event.preventDefault(); event.stopPropagation(); light(); if (!timer) timer = setTimeout(() => activateRef.current?.(), 500); };
    const over = (event: DragEvent) => {
      if (!accepts(event)) { clear(); return; }
      event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move'; light(); if (!timer) timer = setTimeout(() => activateRef.current?.(), 500);
      let scroll = element.parentElement;
      while (scroll) { if (scroll.scrollHeight > scroll.clientHeight + 2) { const rect = scroll.getBoundingClientRect(); if (event.clientY < rect.top + 32) scroll.scrollTop -= 12; if (event.clientY > rect.bottom - 32) scroll.scrollTop += 12; break; } scroll = scroll.parentElement; }
    };
    const leave = (event: DragEvent) => { if (!element.contains(event.relatedTarget)) clear(); };
    const drop = (event: DragEvent) => { if (!accepts(event)) return; event.preventDefault(); event.stopPropagation(); clear(); try { const value = JSON.parse(event.dataTransfer.getData(MIME)); const source = context.current.current; if (!source || value.hostId !== source.hostId || value.agentId !== source.agentId) return; context.current.current = null; setSaving(true); void context.move(source, destination).catch(() => false).finally(() => setSaving(false)); } catch { context.current.current = null; } };
    const document = (globalThis as unknown as { document?: Element }).document;
    document?.addEventListener('dragend', clear); document?.addEventListener('drop', clear);
    for (const [name, handler] of [['dragenter', enter], ['dragover', over], ['dragleave', leave], ['drop', drop], ['dragend', clear]] as const) element.addEventListener(name, handler);
    return () => { if (timer) clearTimeout(timer); if (context.lit.current === clear) context.lit.current = null; document?.removeEventListener('dragend', clear); document?.removeEventListener('drop', clear); for (const [name, handler] of [['dragenter', enter], ['dragover', over], ['dragleave', leave], ['drop', drop], ['dragend', clear]] as const) element.removeEventListener(name, handler); };
  }, [context, destination.hostId, destination.groupId, destination.beforeId, destination.beforeHostId, destination.projectKey, destination.projectTitle, saving]);
  return <View ref={node} collapsable={false} accessibilityState={{ busy: saving }} style={{ minWidth: 0, position: 'relative', borderRadius: 5 }}>
    {children}
    {over && <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 2, right: 2, ...(destination.beforeId ? { height: 2, backgroundColor: view.theme.colors.accent || view.theme.colors.foregroundMuted } : { bottom: 0, borderWidth: 1, borderRadius: 5, borderColor: view.theme.colors.accent || view.theme.colors.foregroundMuted }) }} />}
  </View>;
}
