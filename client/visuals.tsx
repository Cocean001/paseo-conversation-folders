import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Platform, Pressable, View, Image } from 'react-native';
import { Icon } from '@getpaseo/plugin/client/ui';

const paths = {
  conversations: 'M3 4h18v12H8l-5 4V4Zm5 4h8M8 12h5',
  expand: 'M4 4h12v12H4ZM8 20h12V8M7 10h6m-3-3v6',
  collapse: 'M4 4h12v12H4ZM8 20h12V8M7 10h6',
  archive: 'M3 3h18v5H3ZM5 8v13h14V8M10 12h4',
  moreVertical: 'M12 5h.01M12 12h.01M12 19h.01',
  tag: 'M3 3h8l10 10-8 8L3 11Zm5 5h.01',
  tabs: 'M3 5h18v14H3ZM3 9h18M10 5v4',
  sort: 'M4 6h16M4 12h11M4 18h6m5-4 3 4 3-4m-3-9v13',
  filter: 'M3 5h18l-7 8v6l-4 2v-8Z',
  title: 'M4 5h16M12 5v14M8 19h8',
  search: 'M20 20l-5-5M17 10a7 7 0 1 0-14 0 7 7 0 0 0 14 0',
  close: 'm6 6 12 12M6 18 18 6',
  arrowRight: 'M5 12h14m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  alert: 'M12 4v9m0 5h.01',
  clock: 'M12 7v5l3 2M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20ZM2 12h20M12 2c-5 5-5 15 0 20 5-5 5-15 0-20',
  star: 'm12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',
  book: 'M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1Zm0 0v15',
  folder: 'M3 7V5h6l2 2h10v13H3Z',
  server: 'M3 3h18v7H3ZM3 14h18v7H3ZM7 6h.01M7 17h.01',
  project: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  chevron: 'm9 5 7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  menu: 'M5 12h.01M12 12h.01M19 12h.01',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  move: 'M12 3v18M3 12h18m-6-15-3-3-3 3m6 12-3 3-3-3M6 9l-3 3 3 3m12-6 3 3-3 3',
};
export function Glyph({ name, color, size = 14 }: { name: keyof typeof paths; color: string; size?: number }) {
  return <View style={{ width: size, height: size, flexShrink: 0 }}><Icon size={size} color={color} icon={{ svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>` }} /></View>;
}
export function useMotion(target: number) {
  const value = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    let active = true;
    let animation: ReturnType<typeof Animated.timing> | undefined;
    const run = (reduce: boolean) => {
      if (!active) return;
      animation?.stop();
      if (reduce) { value.setValue(target); return; }
      animation = Animated.timing(value, { toValue: target, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: false });
      animation.start();
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(run);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', run);
    return () => { active = false; animation?.stop(); subscription.remove(); };
  }, [value, target]);
  return value;
}
// Animate only the clip height. Contents keep their size and opacity throughout.
export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  const [height, setHeight] = useState(0);
  const progress = useMotion(open ? 1 : 0);
  return <Animated.View pointerEvents={open ? 'auto' : 'none'} accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} style={{ minWidth: 0, overflow: 'hidden', height: height ? progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) : open ? undefined : 0 }}>
    <View onLayout={event => setHeight(event.nativeEvent.layout.height)} style={{ minWidth: 0, flexShrink: 0 }}>{children}</View>
  </Animated.View>;
}
export function Transition({ children }: { identity: string; children: ReactNode }) {
  return <View style={{ minWidth: 0 }}>{children}</View>;
}
export function Disclosure({ open, color }: { open: boolean; color: string }) {
  const progress = useMotion(open ? 1 : 0);
  return <Animated.View style={{ transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }] }}><Glyph name="chevron" color={color} /></Animated.View>;
}

export type LoadingEffect = 'spinner' | 'orbit' | 'pulse' | 'dots' | 'bars';
export const loadingEffects: ReadonlyArray<{ id: LoadingEffect; label: string }> = [
  { id: 'spinner', label: 'Spinner' }, { id: 'orbit', label: 'Orbit' }, { id: 'pulse', label: 'Pulse' }, { id: 'dots', label: 'Three dots' }, { id: 'bars', label: 'Wave bars' },
];
/** One small loop per visible indicator, stopped on unmount and reduced motion. */
export function LoadingMark({ effect = 'spinner', color = '#4F86F7' }: { effect?: LoadingEffect; color?: string }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    let loop: ReturnType<typeof Animated.loop> | undefined;
    const update = (reduce: boolean) => {
      if (!mounted) return;
      setReduced(reduce); loop?.stop(); progress.setValue(0);
      if (!reduce && effect !== 'spinner') { loop = Animated.loop(Animated.timing(progress, { toValue: 1, duration: effect === 'pulse' ? 1400 : 1100, easing: Easing.linear, useNativeDriver: false })); loop.start(); }
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(update);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => { mounted = false; loop?.stop(); subscription.remove(); };
  }, [effect, progress]);
  const wave = (index: number, low: number, high: number) => progress.interpolate({ inputRange: [0, .2, .4, .6, .8, 1], outputRange: Array.from({ length: 6 }, (_, step) => [low, high, low, low, low][(step + 5 - index) % 5]) });
  const dot = { width: 3, height: 3, borderRadius: 2, backgroundColor: color };
  return <View accessibilityLabel={`Loading: ${effect}`} style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
    {effect === 'spinner' ? reduced ? <View style={{ width: 11, height: 11, borderRadius: 6, borderWidth: 1.5, borderColor: color, borderRightColor: 'transparent' }} /> : <ActivityIndicator size={12} color={color} /> :
    effect === 'orbit' ? <Animated.View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: color, transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}><View style={{ ...dot, position: 'absolute', top: -2, left: 4 }} /></Animated.View> :
    effect === 'pulse' ? <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: reduced ? .7 : progress.interpolate({ inputRange: [0, .5, 1], outputRange: [.3, 1, .3] }), transform: [{ scale: reduced ? 1 : progress.interpolate({ inputRange: [0, .5, 1], outputRange: [.75, 1, .75] }) }] }} /> :
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>{[0, 1, 2].map(index => <Animated.View key={index} style={effect === 'dots' ? { ...dot, opacity: reduced ? .7 : wave(index, .25, 1) } : { width: 2, height: 11, borderRadius: 1, backgroundColor: color, transform: [{ scaleY: reduced ? .65 : wave(index, .35, 1) }] }} />)}</View>}
  </View>;
}

export function StatusMark({ state, theme, loadingEffect, loadingColor }: { loadingColor?: string; loadingEffect?: LoadingEffect; state: string; theme: import('@getpaseo/plugin/client').PluginSidebarViewProps['theme'] }) {
  const c = theme.colors;
  const busy = ['running', 'initializing', 'connecting'].includes(state);
  const failed = ['error', 'failed'].includes(state);
  const permission = ['needs_input', 'permission'].includes(state);
  const unread = ['updated', 'attention'].includes(state);
  const completed = ['finished', 'done'].includes(state);
  const label = unread ? 'Unread update' : completed ? 'Completed, read' : state.replace(/_/g, ' ');
  return <View accessibilityLabel={label} style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>{busy ? <LoadingMark effect={loadingEffect} color={loadingColor} /> : failed || permission ? <Glyph name="alert" size={12} color={failed ? c.statusDanger : c.statusWarning} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: unread ? c.accent : completed ? c.statusSuccess : c.foregroundMuted, opacity: unread || completed ? 1 : 0.35 }} />}</View>;
}

/** Keep the item's icon except while busy; collapsed updates use a corner badge. */
export function BranchIcon({ state, hasUpdates = false, open, icon, image, color, theme, loadingEffect, loadingColor }: { loadingColor?: string; loadingEffect?: LoadingEffect; state?: string; hasUpdates?: boolean; open: boolean; icon: import('react').ComponentProps<typeof Glyph>['name']; image?: string; color?: string; theme: import('@getpaseo/plugin/client').PluginSidebarViewProps['theme'] }) {
  const busy = ['running','initializing','connecting'].includes(state || '');
  return <View style={{ width: 16, height: 16, position: 'relative', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {busy ? <StatusMark state={state!} theme={theme} loadingColor={loadingColor} loadingEffect={loadingEffect} /> : image ? <BranchImage uri={image} /> : <Glyph name={icon} color={color || theme.colors.foregroundMuted} />}
    {!open && hasUpdates && <View accessibilityLabel="Updates in collapsed group" style={{ position: 'absolute', right: -3, bottom: -2, width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.statusSuccess, borderWidth: 1, borderColor: theme.colors.surface0 }} />}
  </View>;
}
function BranchImage({ uri }: { uri: string }) { return <Image source={{ uri }} style={{ width: 16, height: 16, borderRadius: 3 }} />; }

// Only the small add field reveals; tree rows keep their immediate layout.
export function EntryReveal({ open, height, children }: { open: boolean; height: number; children: ReactNode }) {
  const progress = useMotion(open ? 1 : 0);
  return <Animated.View pointerEvents={open ? 'auto' : 'none'} accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} style={{ overflow: 'hidden', height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] }), opacity: progress, minWidth: 0 }}><View style={{ minHeight: height, flexShrink: 0 }}>{children}</View></Animated.View>;
}

/** Local button feedback using the host palette; keeps native press and keyboard behavior. */
export function FeedbackPressable({ theme, style, disabled, onHoverIn, onHoverOut, onFocus, onBlur, focusRef, hoverBackground, ...props }: import('react-native').PressableProps & { theme: import('@getpaseo/plugin/client').PluginSidebarViewProps['theme']; focusRef?: import('react').Ref<View>; hoverBackground?: string }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const c = theme.colors;
  return <Pressable {...props} ref={focusRef} disabled={disabled}
    onHoverIn={event => { setHovered(true); onHoverIn?.(event); }}
    onHoverOut={event => { setHovered(false); onHoverOut?.(event); }}
    onFocus={event => { const target = event.target as unknown as { matches?: (selector: string) => boolean }; setFocused(Platform.OS !== 'web' || !!target?.matches?.(':focus-visible')); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={state => {
      const base = typeof style === 'function' ? style(state) : style;
      return [base, { borderRadius: 5, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) } as import('react-native').ViewStyle, !disabled && (hovered || focused || state.pressed) && {
        backgroundColor: hoverBackground === 'transparent' ? 'transparent' : state.pressed ? c.surface2 : hoverBackground || c.surface1,
      }, !disabled && focused && Platform.OS === 'web' && { outlineStyle: 'solid', outlineWidth: 1, outlineOffset: -1, outlineColor: c.foregroundMuted } as import('react-native').ViewStyle];
    }} />;
}

/** Reserve action width; hovering children never changes the row layout. */
export function ActionRow({ children, action, idleAction, persistent = false, compact = false, theme, active = false, selected = false, hoverBackground }: { idleAction?: ReactNode; selected?: boolean; hoverBackground?: string; children: ReactNode; action: ReactNode; persistent?: boolean; compact?: boolean; theme?: import('@getpaseo/plugin/client').PluginSidebarViewProps['theme']; active?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const visible = compact || Platform.OS !== 'web' || hovered || focused || persistent;
  const highlight = useMotion(hovered || focused || active || selected ? 1 : 0);
  const actionOpacity = useMotion(visible ? 1 : 0);
  return <View onPointerEnter={event => { if (event.nativeEvent.pointerType !== 'touch') setHovered(true); }} onPointerLeave={() => setHovered(false)} {...(Platform.OS === 'web' ? { onFocus: (event: import('react-native').FocusEvent) => { const target = event.target as unknown as { matches?: (selector: string) => boolean }; setFocused(!!target?.matches?.(':focus-visible')); }, onBlur: (event: import('react-native').BlurEvent) => { const browserEvent = event as unknown as { currentTarget: { contains(node: unknown): boolean }; relatedTarget: unknown }; if (!browserEvent.currentTarget.contains(browserEvent.relatedTarget)) setFocused(false); } } : {})} style={{ flexDirection: 'row', alignItems: 'stretch', minWidth: 0, borderRadius: 5, paddingRight: 4, backgroundColor: 'transparent' }}>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 5, backgroundColor: active || selected ? theme?.colors.surface2 : hoverBackground || theme?.colors.surface1, opacity: highlight }} />
    {children}<Animated.View pointerEvents={visible ? 'auto' : 'none'} style={{ opacity: idleAction ? 1 : actionOpacity, justifyContent: 'center', alignSelf: 'stretch' }}>{idleAction ? <View style={{ justifyContent: 'center' }}>
      <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={{ opacity: actionOpacity }}>{action}</Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, alignItems: 'flex-end', opacity: actionOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>{idleAction}</Animated.View>
    </View> : action}</Animated.View>
  </View>;
}

/** Only newly saved folders enter; existing tree rows retain their layout. */
export function FolderArrival({ fresh, children }: { fresh: boolean; children: ReactNode }) {
  const [entered, setEntered] = useState(!fresh);
  useEffect(() => { setEntered(true); }, []);
  const progress = useMotion(entered ? 1 : 0);
  return <Animated.View style={{ minWidth: 0, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>{children}</Animated.View>;
}
