import { createLayoutMotion, conversationMotionKey, type MotionElement } from './layout-motion';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import type { PluginSidebarViewProps } from '@getpaseo/plugin/client';
export interface DragConversation { hostId: string; agentId: string }
export interface ConversationDestination { hostId: string; groupId: string | null; beforeId?: string; beforeHostId?: string; projectKey?: string; projectTitle?: string }
const MIME = 'application/x-paseo-conversation-folder';
interface Transfer { types: readonly string[]; effectAllowed: string; dropEffect: string; setData(type: string, data: string): void; getData(type: string): string }
interface DragEvent { dataTransfer: Transfer; clientY: number; relatedTarget?: unknown; preventDefault(): void; stopPropagation(): void }
interface Element { style: { opacity: string }; draggable: boolean; addEventListener(type: string, handler: (event: DragEvent) => void): void; removeEventListener(type: string, handler: (event: DragEvent) => void): void; contains(node: unknown): boolean; parentElement: Element | null; scrollHeight: number; clientHeight: number; scrollTop: number; getBoundingClientRect(): { top: number; bottom: number } }
const DragContext = createContext<{ current: { current: DragConversation | null }; move(source: DragConversation, destination: ConversationDestination): Promise<boolean>; motion?: ReturnType<typeof createLayoutMotion> } | null>(null);
export function ConversationDragProvider({ children, move }: { children: ReactNode; move(source: DragConversation, destination: ConversationDestination): Promise<boolean> }) {
  const current = useRef<DragConversation | null>(null);
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
  return <DragContext.Provider value={{ current, move: animatedMove, motion: motion.current }}>{children}</DragContext.Provider>;
}
export function DragConversationRow({ source, children }: { source: DragConversation; children: ReactNode }) {
  const context = useContext(DragContext);
  const node = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !context) return;
    const element = node.current as unknown as Element | null;
    if (!element?.addEventListener) return;
    const unregister = context.motion?.register(conversationMotionKey(source.hostId, source.agentId), element as unknown as MotionElement);
    element.draggable = true;
    const start = (event: DragEvent) => { context.current.current = source; event.stopPropagation(); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(MIME, JSON.stringify(source)); element.style.opacity = '0.5'; };
    const end = () => { context.current.current = null; element.style.opacity = ''; };
    element.addEventListener('dragstart', start); element.addEventListener('dragend', end);
    return () => { unregister?.(); element.removeEventListener('dragstart', start); element.removeEventListener('dragend', end); element.draggable = false; element.style.opacity = ''; };
  }, [context, source.hostId, source.agentId]);
  return <View ref={node} accessibilityHint="Drag to a folder or above another conversation to organize" style={{ minWidth: 0 }}>{children}</View>;
}
export function ConversationDropTarget({ destination, children, view, activate }: { destination: ConversationDestination; children: ReactNode; view: PluginSidebarViewProps; activate?(): void }) {
  const context = useContext(DragContext);
  const node = useRef<View>(null);
  const [over, setOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const activateRef = useRef(activate); activateRef.current = activate;
  useEffect(() => {
    if (Platform.OS !== 'web' || !context) return;
    const element = node.current as unknown as Element | null;
    if (!element?.addEventListener) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { if (timer) clearTimeout(timer); timer = undefined; setOver(false); };
    const accepts = (event: DragEvent) => !saving && !!context.current.current && (destination.projectKey || destination.groupId !== null || context.current.current.hostId === destination.hostId) && !(context.current.current.agentId === destination.beforeId && context.current.current.hostId === (destination.beforeHostId ?? destination.hostId)) && Array.from(event.dataTransfer.types).includes(MIME);
    const enter = (event: DragEvent) => { if (!accepts(event)) return; event.preventDefault(); event.stopPropagation(); setOver(true); if (!timer) timer = setTimeout(() => activateRef.current?.(), 500); };
    const over = (event: DragEvent) => {
      if (!accepts(event)) { clear(); return; }
      event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move';
      let scroll = element.parentElement;
      while (scroll) { if (scroll.scrollHeight > scroll.clientHeight + 2) { const rect = scroll.getBoundingClientRect(); if (event.clientY < rect.top + 32) scroll.scrollTop -= 12; if (event.clientY > rect.bottom - 32) scroll.scrollTop += 12; break; } scroll = scroll.parentElement; }
    };
    const leave = (event: DragEvent) => { if (!element.contains(event.relatedTarget)) clear(); };
    const drop = (event: DragEvent) => { if (!accepts(event)) return; event.preventDefault(); event.stopPropagation(); clear(); try { const value = JSON.parse(event.dataTransfer.getData(MIME)); const source = context.current.current; if (!source || value.hostId !== source.hostId || value.agentId !== source.agentId) return; context.current.current = null; setSaving(true); void context.move(source, destination).finally(() => setSaving(false)); } catch { context.current.current = null; } };
    const document = (globalThis as unknown as { document?: Element }).document;
    document?.addEventListener('dragend', clear); document?.addEventListener('drop', clear);
    for (const [name, handler] of [['dragenter', enter], ['dragover', over], ['dragleave', leave], ['drop', drop], ['dragend', clear]] as const) element.addEventListener(name, handler);
    return () => { if (timer) clearTimeout(timer); document?.removeEventListener('dragend', clear); document?.removeEventListener('drop', clear); for (const [name, handler] of [['dragenter', enter], ['dragover', over], ['dragleave', leave], ['drop', drop], ['dragend', clear]] as const) element.removeEventListener(name, handler); };
  }, [context, destination.hostId, destination.groupId, destination.beforeId, destination.beforeHostId, saving]);
  return <View ref={node} accessibilityState={{ busy: saving }} style={{ minWidth: 0, position: 'relative', borderRadius: 5, backgroundColor: over && !destination.beforeId ? view.theme.colors.surface2 : undefined }}>
    {children}
    {over && <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 2, right: 2, ...(destination.beforeId ? { height: 2, backgroundColor: view.theme.colors.accent || view.theme.colors.foregroundMuted } : { bottom: 0, borderWidth: 1, borderRadius: 5, borderColor: view.theme.colors.accent || view.theme.colors.foregroundMuted }) }} />}
  </View>;
}
