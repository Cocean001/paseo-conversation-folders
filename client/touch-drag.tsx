import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, Text, View, type GestureResponderEvent, type ScrollViewProps } from 'react-native';
import type { PluginSidebarViewProps } from '@getpaseo/plugin/client';
import type { DragFolder } from './folder-drag';
import type { DragConversation } from './drag-and-drop';
import { useSteadyControl } from './steady';

/**
 * Touch drag for phones, where the browser drag API is missing (native app) or unusable (mobile Safari).
 * Long-press lifts a row; moving drags it, releasing in place runs the row's own long-press menu instead.
 * Drop targets reuse their desktop placement rules through resolve().
 */
export type TouchSource = { kind: 'folder'; value: DragFolder } | { kind: 'conversation'; value: DragConversation };
export type TouchPosition = 'before' | 'after' | 'inside';
export interface Rect { top: number; height: number }
export interface TouchDrop { position: TouchPosition; commit(): Promise<unknown> }
export interface TouchTarget {
  node: { current: unknown };
  resolve(source: TouchSource, y: number, rect: Rect): TouchDrop | null;
  show(position: TouchPosition | null): void;
}
interface ScrollHandle { node: { current: { scrollTo?(options: { y: number; animated: boolean }): void } | null }; metrics: { current: { offset: number; content: number } }; setLocked(locked: boolean): void }
export interface TouchDragEngine {
  register(target: TouchTarget): () => void;
  attachScroll(handle: ScrollHandle): () => void;
  lift(source: TouchSource, label: string, fallback?: () => void): void;
}

/** Targets under the finger, innermost first, like DOM bubbling: the first one that accepts wins. */
export function underFinger<T extends { rect: Rect }>(entries: readonly T[], y: number): T[] {
  return entries.filter(entry => entry.rect.height > 0 && y >= entry.rect.top && y < entry.rect.top + entry.rect.height).sort((a, b) => a.rect.height - b.rect.height);
}

/** Auto-scroll speed in px per frame: zero in the middle, faster the deeper the finger is in an edge band.
 *  The band scales with the list, since phones may leave the sidebar only a few rows of height. */
export function edgeSpeed(y: number, viewport: Rect, band = Math.min(48, viewport.height / 8), max = 8) {
  const top = viewport.top + band, bottom = viewport.top + viewport.height - band;
  const depth = y < top ? y - top : y > bottom ? y - bottom : 0;
  return Math.round(max * Math.max(-1, Math.min(1, depth / band)));
}

type Measurable = { measure?(callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void): void };
const measure = (node: unknown) => new Promise<Rect | null>(resolve => {
  const target = node as Measurable | null;
  if (!target?.measure) { resolve(null); return; }
  target.measure((_x, _y, _width, height, _pageX, pageY) => resolve(Number.isFinite(pageY) && Number.isFinite(height) ? { top: pageY, height } : null));
});
const touchY = (event: GestureResponderEvent) => {
  const native = event.nativeEvent as unknown as { pageY?: number; touches?: ArrayLike<{ pageY: number }>; changedTouches?: ArrayLike<{ pageY: number }> };
  return native.touches?.[0]?.pageY ?? native.changedTouches?.[0]?.pageY ?? native.pageY ?? 0;
};

const Context = createContext<TouchDragEngine | null>(null);
/** The touch engine when this layout drags by touch; null on desktop, where rows use the browser drag API. */
export const useTouchDrag = () => useContext(Context);

export function TouchDragProvider({ enabled, view, children }: { enabled: boolean; view: PluginSidebarViewProps; children: ReactNode }) {
  const root = useRef<View>(null);
  const [ghost, setGhost] = useState<{ label: string; top: number } | null>(null);
  const steady = useSteadyControl();
  const steadyRef = useRef(steady); steadyRef.current = steady;
  const engine = useRef<ReturnType<typeof createEngine> | null>(null);
  if (!engine.current) engine.current = createEngine(root, setGhost, dragging => steadyRef.current?.(dragging));
  useEffect(() => () => engine.current?.cancel(), []);
  // Mobile Safari scrolls on touchmove unless a non-passive listener cancels it; React's touch listeners are passive.
  useEffect(() => {
    const element = root.current as unknown as { addEventListener?(type: string, handler: (event: { preventDefault(): void }) => void, options: { passive: boolean }): void; removeEventListener?(type: string, handler: (event: { preventDefault(): void }) => void): void } | null;
    if (Platform.OS !== 'web' || !enabled || !element?.addEventListener) return;
    const block = (event: { preventDefault(): void }) => { if (engine.current?.lifted()) event.preventDefault(); };
    element.addEventListener('touchmove', block, { passive: false });
    return () => element.removeEventListener?.('touchmove', block);
  }, [enabled]);
  const run = engine.current;
  const c = view.theme.colors;
  return <Context.Provider value={enabled ? run : null}>
    <View ref={root} collapsable={false} style={{ flex: 1, minWidth: 0, width: '100%' }}
      {...(enabled ? { onTouchStart: (event: GestureResponderEvent) => run.touchStart(touchY(event)), onTouchMove: (event: GestureResponderEvent) => run.touchMove(touchY(event)), onTouchEnd: () => run.touchEnd(), onTouchCancel: () => run.cancel() } : {})}>
      {children}
      {ghost && <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, top: Math.max(0, ghost.top - 60), minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: c.accent || c.border, backgroundColor: c.surface1, opacity: 0.95, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 }}>
        <Text selectable={false} numberOfLines={1} style={{ color: c.foreground, fontSize: 14, fontWeight: '500' }}>{ghost.label}</Text>
      </View>}
    </View>
  </Context.Provider>;
}

export function createEngine(root: { current: unknown }, setGhost: (ghost: { label: string; top: number } | null) => void, onDrag?: (dragging: boolean) => void) {
  const targets = new Set<TouchTarget>();
  let entries: Array<{ target: TouchTarget; rect: Rect }> = [];
  let lift: { source: TouchSource; label: string; fallback?: () => void; startY: number; dragging: boolean } | null = null;
  let current: { target: TouchTarget; drop: TouchDrop } | null = null;
  let scroll: ScrollHandle | null = null;
  let viewport: Rect | null = null;
  let rootTop = 0, rootReady = false, lastY = 0, speed = 0, generation = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  const hover = () => {
    if (!lift?.dragging) return;
    let next: typeof current = null;
    for (const entry of underFinger(entries, lastY)) {
      const drop = entry.target.resolve(lift.source, lastY, entry.rect);
      if (drop) { next = { target: entry.target, drop }; break; }
    }
    if (current && current.target !== next?.target) current.target.show(null);
    if (next && (current?.target !== next.target || current.drop.position !== next.drop.position)) next.target.show(next.drop.position);
    current = next;
  };
  const step = () => {
    const handle = scroll;
    if (!handle || !viewport || !speed) return;
    const metrics = handle.metrics.current;
    const next = Math.max(0, Math.min(Math.max(0, metrics.content - viewport.height), metrics.offset + speed));
    const delta = next - metrics.offset;
    if (!delta) return;
    handle.node.current?.scrollTo?.({ y: next, animated: false });
    metrics.offset = next;
    entries = entries.map(entry => ({ ...entry, rect: { ...entry.rect, top: entry.rect.top - delta } }));
    hover();
  };
  const stopScroll = () => { speed = 0; if (timer) clearInterval(timer); timer = undefined; };
  const finish = () => {
    generation++;
    stopScroll();
    current?.target.show(null);
    if (lift) onDrag?.(false);
    current = null; entries = []; viewport = null; lift = null;
    scroll?.setLocked(false);
    setGhost(null);
  };
  const begin = async () => {
    const run = ++generation;
    const list = Array.from(targets);
    const [rects, frame] = await Promise.all([Promise.all(list.map(target => measure(target.node.current))), scroll ? measure(scroll.node.current) : Promise.resolve(null)]);
    if (run !== generation || !lift) return;
    entries = list.flatMap((target, index) => rects[index] ? [{ target, rect: rects[index]! }] : []);
    viewport = frame;
    hover();
  };
  return {
    register(target: TouchTarget) { targets.add(target); return () => { targets.delete(target); if (current?.target === target) current = null; }; },
    attachScroll(handle: ScrollHandle) { scroll = handle; return () => { if (scroll === handle) scroll = null; }; },
    lifted: () => !!lift,
    lift(source: TouchSource, label: string, fallback?: () => void) {
      lift = { source, label, fallback, startY: lastY, dragging: false };
      onDrag?.(true);
      scroll?.setLocked(true);
      rootReady = false;
      void measure(root.current).then(rect => { rootTop = rect?.top ?? 0; rootReady = true; if (lift) setGhost({ label, top: lastY - rootTop }); });
    },
    touchStart(y: number) { if (lift) finish(); lastY = y; },
    touchMove(y: number) {
      lastY = y;
      if (!lift) return;
      if (!lift.dragging && Math.abs(y - lift.startY) > 8) { lift.dragging = true; void begin(); }
      if (rootReady) setGhost({ label: lift.label, top: y - rootTop });
      if (!lift.dragging) return;
      hover();
      speed = viewport ? edgeSpeed(y, viewport) : 0;
      if (speed && !timer) timer = setInterval(step, 16);
      if (!speed && timer) stopScroll();
    },
    touchEnd() {
      if (!lift) return;
      const { dragging, fallback } = lift;
      if (dragging) hover();
      const drop = current?.drop;
      finish();
      if (!dragging) fallback?.();
      else if (drop) void drop.commit().catch(() => false);
    },
    cancel: finish,
  };
}

/** The sidebar scroller: locked while a row is lifted, and scrolled by the engine near its edges. */
export function TouchScrollView({ onScroll, onContentSizeChange, ...props }: ScrollViewProps & { children?: ReactNode }) {
  const engine = useTouchDrag();
  const node = useRef<ScrollView>(null);
  const metrics = useRef({ offset: 0, content: 0 });
  const [locked, setLocked] = useState(false);
  useEffect(() => engine?.attachScroll({ node: node as unknown as ScrollHandle['node'], metrics, setLocked }), [engine]);
  return <ScrollView {...props} ref={node} scrollEnabled={!locked && props.scrollEnabled !== false} scrollEventThrottle={16}
    onScroll={event => { metrics.current.offset = event.nativeEvent.contentOffset.y; onScroll?.(event); }}
    onContentSizeChange={(width, height) => { metrics.current.content = height; onContentSizeChange?.(width, height); }} />;
}
