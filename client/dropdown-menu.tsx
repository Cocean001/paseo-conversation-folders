import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import type { PluginSidebarViewProps } from '@getpaseo/plugin/client';
import { FeedbackPressable, Glyph, useMotion } from './visuals';

export interface DropdownItem {
  id: string;
  label: string;
  content?: ReactNode;
  height?: number;
  preview?: ReactNode;
  icon?: import('react').ComponentProps<typeof Glyph>['name'];
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  items?: readonly DropdownItem[];
  keepOpen?: boolean;
  onSelect?(): void | Promise<void>;
}
export interface DropdownAnchor { right: number; top: number }
/** Theme-aware anchored menu for custom sidebar views; no app-internal imports. */
export function DropdownMenu({ anchor, items, close, view, busy = false, error, header }: {
  anchor: DropdownAnchor | null;
  items: readonly DropdownItem[];
  close(): void;
  view: PluginSidebarViewProps;
  busy?: boolean;
  error?: string | null;
  header?: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const [submenu, setSubmenu] = useState<string | null>(null);
  const rootRefs = useRef<Array<View | null>>([]);
  const subRefs = useRef<Array<View | null>>([]);
  const activeIndex = useRef(0);
  const restore = useRef<{ focus?(): void } | null>(null);
  const progress = useMotion(anchor ? 1 : 0);
  const compact = view.layout.compact || width < 600;
  const c = view.theme.colors;
  const rowHeight = compact ? 44 : 32;
  const menuWidth = Math.min(compact ? 288 : 260, width - 16);
  const panelHeight = (entries: readonly DropdownItem[]) => entries.reduce((sum, item) => sum + (item.height ?? rowHeight), 0) + entries.filter(item => item.separatorBefore).length * 9 + 10;
  const parentIndex = items.findIndex(item => item.id === submenu);
  const parent = items[parentIndex];
  const childItems = parent?.items ?? [];
  const rootHeight = Math.min(panelHeight(items) + (header ? 44 : 0) + (error ? 48 : 0), height - 16);
  const left = Math.max(8, Math.min((anchor?.right ?? 0) - menuWidth, width - menuWidth - 8));
  const top = Math.max(8, Math.min(anchor?.top ?? 0, height - rootHeight - 8));
  const subWidth = Math.min(224, width - 16);
  const flyoutLeft = left + menuWidth + subWidth <= width - 8 ? left + menuWidth : Math.max(8, left - subWidth);
  const parentOffset = (header ? 44 : 0) + items.slice(0, Math.max(0, parentIndex)).reduce((sum, item) => sum + (item.height ?? rowHeight) + (item.separatorBefore ? 9 : 0), 5);
  const subTop = Math.max(8, Math.min(top + parentOffset, height - Math.min(panelHeight(childItems), height - 16) - 8));
  useEffect(() => {
    if (!anchor) return;
    setSubmenu(null);
    restore.current = (globalThis as unknown as { document?: { activeElement: { focus?(): void } | null } }).document?.activeElement ?? null;
    activeIndex.current = 0;
    return () => { restore.current?.focus?.(); };
  }, [anchor]);
  useEffect(() => { if (submenu) { activeIndex.current = 0; subRefs.current[0]?.focus(); } }, [submenu]);
  if (!anchor) return null;
  function openChild(item: DropdownItem, index: number) {
    if (!item.disabled && !busy && item.items) { activeIndex.current = index; setSubmenu(item.id); }
  }
  function keyboard(event: { key: string; preventDefault(): void; stopPropagation(): void; target?: { tagName?: string } }) {
    if (event.key !== 'Escape' && ['INPUT','TEXTAREA'].includes(event.target?.tagName || '')) return;
    const entries = submenu ? childItems : items;
    const refs = submenu ? subRefs.current : rootRefs.current;
    if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'ArrowLeft' && submenu) { event.preventDefault(); setSubmenu(null); activeIndex.current = parentIndex; rootRefs.current[parentIndex]?.focus(); return; }
    if (event.key === 'ArrowRight' && !submenu) { event.preventDefault(); const item = items[activeIndex.current]; if (item) openChild(item, activeIndex.current); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = event.key === 'Home' ? -1 : event.key === 'End' ? entries.length : activeIndex.current;
    const direction = event.key === 'ArrowUp' || event.key === 'End' ? -1 : 1;
    for (let i = 0; i < entries.length; i++) { next = (next + direction + entries.length) % entries.length; if (!entries[next].disabled && !entries[next].content) { activeIndex.current = next; refs[next]?.focus(); break; } }
  }
  const panel = { backgroundColor: c.surface1, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 4, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 10, elevation: 5 };
  function rows(entries: readonly DropdownItem[], child: boolean) {
    return entries.map((item, index) => <View key={item.id}>
      {item.separatorBefore && <View style={{ height: 1, backgroundColor: c.border, marginVertical: 4, marginHorizontal: -4 }} />}
      {item.content ? <View style={{ minHeight: item.height, paddingHorizontal: 10 }}>{item.content}</View> : <FeedbackPressable theme={view.theme} hoverBackground={c.surface2} focusRef={node => { (child ? subRefs.current : rootRefs.current)[index] = node; }}
        accessibilityRole="menuitem" accessibilityLabel={item.label} accessibilityState={{ disabled: busy || item.disabled, ...(item.checked === undefined ? {} : { checked: item.checked }) }} disabled={busy || item.disabled}
        onFocus={() => { activeIndex.current = index; }}
        onHoverIn={() => { if (!child && !compact && !busy) { if (item.items) setSubmenu(item.id); else setSubmenu(null); } }}
        onPress={() => { if (item.items) openChild(item, index); else { void item.onSelect?.(); if (child && !item.keepOpen) { setSubmenu(null); activeIndex.current = parentIndex; rootRefs.current[parentIndex]?.focus(); } } }}
        style={{ minHeight: rowHeight, backgroundColor: !child && submenu === item.id ? c.surface2 : undefined, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: item.disabled || busy ? 0.5 : 1 }}>
        {item.preview}
        {item.icon && <Glyph name={item.icon} color={c.foregroundMuted} />}
        <Text numberOfLines={1} style={{ color: c.foreground, fontSize: 12, flex: 1 }}>{item.label}</Text>
        {item.value && <Text numberOfLines={1} style={{ color: c.foregroundMuted, fontSize: 12, maxWidth: '55%' }}>{item.value}</Text>}
        {item.checked && <Glyph name="check" size={13} color={c.foreground} />}
        {item.items && <Glyph name="chevron" size={12} color={c.foregroundMuted} />}
      </FeedbackPressable>}
    </View>);
  }
  return <Modal transparent visible animationType="none" onRequestClose={close} onShow={() => rootRefs.current[0]?.focus()}>
    <View style={{ flex: 1 }} {...{ onKeyDown: keyboard }}>
      <Pressable accessibilityLabel="Dismiss view options" onPress={close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <Animated.View accessibilityRole="menu" accessibilityLabel="View options menu" style={[panel, { position: 'absolute', left, top, width: menuWidth, maxHeight: height - top - 8, opacity: progress }]}>
        <ScrollView keyboardShouldPersistTaps="handled">
          {(!compact || !submenu) && header}
          {compact && submenu ? <>
            <FeedbackPressable theme={view.theme} onPress={() => { setSubmenu(null); activeIndex.current = parentIndex; rootRefs.current[parentIndex]?.focus(); }} accessibilityLabel="Back to view options" style={{ minHeight: rowHeight, paddingHorizontal: 10, justifyContent: 'center' }}><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>‹ {parent?.label}</Text></FeedbackPressable>
            {rows(childItems, true)}
          </> : rows(items, false)}
          {busy && <Text accessibilityLiveRegion="polite" style={{ color: c.foregroundMuted, fontSize: 11, padding: 8 }}>Saving…</Text>}
          {error && <Text accessibilityRole="alert" style={{ color: c.statusDanger, fontSize: 11, padding: 8 }}>{error}</Text>}
        </ScrollView>
      </Animated.View>
      {!compact && submenu && <View accessibilityRole="menu" accessibilityLabel={parent?.label} style={[panel, { position: 'absolute', left: flyoutLeft, top: subTop, width: subWidth, maxHeight: height - subTop - 8 }]}><ScrollView keyboardShouldPersistTaps="handled">{rows(childItems, true)}</ScrollView></View>}
    </View>
  </Modal>;
}
