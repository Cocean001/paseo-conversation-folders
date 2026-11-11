import { useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, useWindowDimensions } from 'react-native';
import type { PluginSidebarViewProps } from '@getpaseo/plugin/client';
import { FeedbackPressable, useMotion } from './visuals';
import { Animated } from 'react-native';
export type MenuPoint = { x: number; y: number };
export interface MenuAction { id: string; label: string; disabled?: boolean; danger?: boolean; onSelect(): void }
/** Public plugin APIs have no arbitrary-row context menu; all colors come from the current host theme. */
export function ContextMenu({ anchor, actions, close, view }: { anchor: MenuPoint | null; actions: readonly MenuAction[]; close(): void; view: PluginSidebarViewProps }) {
  const { width, height } = useWindowDimensions();
  const refs = useRef<Array<View | null>>([]);
  const index = useRef(0);
  const restore = useRef<{ focus?(): void } | null>(null);
  const progress = useMotion(anchor ? 1 : 0);
  const focus = (next: number) => { index.current = next; refs.current[next]?.focus(); };
  const first = () => focus(Math.max(0, actions.findIndex(action => !action.disabled)));
  useEffect(() => {
    if (!anchor) return;
    restore.current = (globalThis as unknown as { document?: { activeElement: { focus?(): void } | null } }).document?.activeElement ?? null;
    first();
    return () => { restore.current?.focus?.(); };
  }, [anchor]);
  if (!anchor) return null;
  const c = view.theme.colors;
  const rowHeight = view.layout.compact ? 44 : 30;
  const menuWidth = Math.min(208, width - 16);
  const menuHeight = actions.length * rowHeight + 10;
  function keyboard(event: { key: string; preventDefault(): void; stopPropagation(): void }) {
    if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = event.key === 'Home' ? -1 : event.key === 'End' ? actions.length : index.current;
    const direction = event.key === 'ArrowUp' || event.key === 'End' ? -1 : 1;
    for (let n = 0; n < actions.length; n++) { next = (next + direction + actions.length) % actions.length; if (!actions[next].disabled) { focus(next); break; } }
  }
  return <Modal transparent visible animationType="none" onShow={first} onRequestClose={close}>
    <View style={{ flex: 1 }} {...{ onKeyDown: keyboard }}>
      <Pressable accessibilityLabel="Dismiss context menu" onPress={close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <Animated.View accessibilityRole="menu" accessibilityLabel="Row actions" style={{ position: 'absolute', left: Math.max(8, Math.min(anchor.x, width - menuWidth - 8)), top: Math.max(8, Math.min(anchor.y, height - menuHeight - 8)), width: menuWidth, padding: 4, borderRadius: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface1, opacity: progress, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 }}>
        {actions.map((action, i) => <FeedbackPressable key={action.id} theme={view.theme} hoverBackground={c.surface2} focusRef={node => { refs.current[i] = node; }} accessibilityRole="menuitem" accessibilityLabel={action.label} disabled={action.disabled} onFocus={() => { index.current = i; }} onPress={() => { close(); action.onSelect(); }} style={{ minHeight: rowHeight, justifyContent: 'center', paddingHorizontal: 10, opacity: action.disabled ? 0.4 : 1 }}>
          <Text style={{ color: action.danger ? c.statusDanger : c.foreground, fontSize: 12 }}>{action.label}</Text>
        </FeedbackPressable>)}
      </Animated.View>
    </View>
  </Modal>;
}
