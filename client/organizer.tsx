import type { PluginHostProps } from '@getpaseo/plugin/client';
import { useSettings } from '@getpaseo/plugin/client';
import { Icon, SidebarRow } from '@getpaseo/plugin/client/ui';
import { useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { ReactNode } from 'react';
import { organization } from '../shared/settings';
import { moveAgent, moveGroup, orderedIds, removeGroup, type Organization } from '../shared/model';
import { useConversations } from './use-agents';

type Drag = { kind: 'agent' | 'group'; id: string };
type Target = { key: string; groupId: string | null; beforeId?: string; groupHeader?: boolean };
type Box = Target & { x: number; y: number; width: number; height: number };

function Grip({ label, color, begin, hover, finish, cancel, select }: {
  label: string; color: string; begin(): void; hover(x: number, y: number): void; finish(): void; cancel(): void; select(): void;
}) {
  const latest = useRef({ begin, hover, finish, cancel }); latest.current = { begin, hover, finish, cancel };
  const responder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5,
    onPanResponderGrant: () => latest.current.begin(),
    onPanResponderMove: (_, gesture) => latest.current.hover(gesture.moveX, gesture.moveY),
    onPanResponderRelease: () => latest.current.finish(),
    onPanResponderTerminate: () => latest.current.cancel(),
  })).current;
  return <View {...responder.panHandlers}><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={select} style={{ width: 28, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color, fontSize: 16 }}>⠿</Text></Pressable></View>;
}

export function Organizer({ theme, layout, onOpen, sidebar = false }: PluginHostProps & { onOpen(id: string): void; sidebar?: boolean }) {
  const settings = useSettings(organization);
  const { agents, loading, error: listError } = useConversations();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [tools, setTools] = useState(false);
  const [selected, setSelected] = useState<Drag | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const nodes = useRef(new Map<string, { node: View; target: Target }>());
  const boxes = useRef<Box[]>([]);
  const dragging = useRef<Drag | null>(null);
  const destination = useRef<Target | null>(null);
  const pending = useRef(false);
  const c = theme.colors;
  const label = { color: c.foreground, fontSize: 13, lineHeight: 18 };
  const muted = { ...label, color: c.foregroundMuted };
  const latestSettings = useRef(settings); latestSettings.current = settings;
  const rowHeight = layout.compact ? 46 : 40;

  async function commit(update: (state: Organization) => Organization): Promise<boolean> {
    const current = latestSettings.current;
    if (current.status !== 'ready' || pending.current) return false;
    pending.current = true;
    try {
      const ok = await current.save(update(current.values), current.revision);
      if (!ok) setNotice('保存失败或其他设备已修改；请刷新后重试。');
      else { setSelected(null); setNotice(null); }
      return ok;
    } finally { pending.current = false; }
  }
  function toggle(id: string) {
    setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function start(source: Drag) {
    if (pending.current || settings.saving) return;
    dragging.current = source; destination.current = null; boxes.current = []; setSelected(source);
    for (const { node, target } of nodes.current.values()) node.measureInWindow((x, y, width, height) => { boxes.current.push({ ...target, x, y, width, height }); });
  }
  function hover(x: number, y: number) {
    const source = dragging.current;
    const matches = boxes.current.filter(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height && (source?.kind !== 'group' || b.groupHeader));
    const target = matches.sort((a, b) => a.height - b.height)[0] ?? null;
    destination.current = target; setHoverKey(target?.key ?? null);
  }
  function cancelDrag() { dragging.current = null; destination.current = null; setHoverKey(null); setSelected(null); }
  function drop() {
    const source = dragging.current, target = destination.current;
    dragging.current = null; destination.current = null; setHoverKey(null);
    if (!source || !target) { setSelected(null); return; }
    if (source.kind === 'group' && target.groupId) void commit(s => moveGroup(s, source.id, target.groupId!));
    else if (source.kind === 'agent') void commit(s => moveAgent(s, source.id, target.groupId, target.beforeId));
  }
  function destinationPress(groupId: string | null) {
    if (selected?.kind === 'agent') void commit(s => moveAgent(s, selected.id, groupId));
  }
  function targetView(target: Target, children: ReactNode) {
    return <View key={target.key} ref={node => { if (node) nodes.current.set(target.key, { node, target }); else nodes.current.delete(target.key); }} style={{ borderTopWidth: hoverKey === target.key ? 2 : 0, borderTopColor: c.accent, borderRadius: 10, overflow: 'hidden', backgroundColor: hoverKey === target.key ? c.surface2 : undefined }}>{children}</View>;
  }
  function action(title: string, onPress: () => void, options: { danger?: boolean; disabled?: boolean; glyph?: string } = {}) {
    return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={options.disabled || settings.saving} onPress={onPress} style={{ minHeight: 36, minWidth: options.glyph ? 32 : undefined, paddingHorizontal: options.glyph ? 2 : 8, justifyContent: 'center', alignItems: 'center', opacity: options.disabled ? 0.4 : 1 }}>{options.glyph ? <Icon name={options.glyph === '+' ? 'Plus' : 'Ellipsis'} size={16} color={c.foregroundMuted} /> : <Text style={{ ...muted, fontSize: 12, color: options.danger ? c.statusDanger : c.foregroundMuted }}>{title}</Text>}</Pressable>;
  }
  function age(value?: string) {
    if (!value) return '';
    const elapsed = Date.now() - Date.parse(value);
    if (!Number.isFinite(elapsed)) return '';
    const minutes = Math.max(0, Math.floor(elapsed / 60000));
    return minutes < 1 ? '刚刚' : minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
  }
  function agentRow(id: string, groupId: string | null) {
    const agent = agents.find(a => a.id === id);
    if (!agent || (query && !(agent.title ?? agent.cwd).toLocaleLowerCase().includes(query.toLocaleLowerCase()))) return null;
    const source: Drag = { kind: 'agent', id };
    if (sidebar && !tools && !selected) return targetView({ key: `agent:${id}`, groupId, beforeId: id }, <SidebarRow
      id={`conversation-${id}`} label={agent.title || '未命名对话'}
      icon={agent.status === 'running' ? 'LoaderCircle' : 'MessageCircle'}
      active={openedId === id}
      onPress={() => { setOpenedId(id); onOpen(id); }}
      trailing={<Text style={{ ...muted, fontSize: 11, flexShrink: 0 }}>{age(agent.lastActivityAt)}</Text>}
    />);
    return targetView({ key: `agent:${id}`, groupId, beforeId: id }, <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: selected?.id === id || openedId === id ? c.surface2 : undefined, paddingLeft: tools || selected ? 0 : 14 }}>
      {(tools || selected) && <Grip color={c.foregroundMuted} cancel={cancelDrag} label={`移动对话 ${agent.title ?? '未命名对话'}`} begin={() => start(source)} hover={hover} finish={drop} select={() => setSelected(source)} />}
      <Pressable accessibilityRole="button" accessibilityLabel={`打开对话 ${agent.title ?? '未命名对话'}`} onPress={() => { setOpenedId(id); onOpen(id); }} onLongPress={() => { setTools(true); setSelected(source); }} style={{ flex: 1, minHeight: rowHeight, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 12, minWidth: 0 }}>
        <Text style={{ color: agent.status === 'running' ? c.statusSuccess : agent.status === 'error' ? c.statusDanger : c.foregroundMuted, fontSize: 8, opacity: agent.status === 'running' || agent.status === 'error' ? 1 : 0.45 }}>●</Text>
        <Text numberOfLines={1} style={{ ...label, flex: 1 }}>{agent.title || '未命名对话'}</Text>
        <Text style={{ ...muted, fontSize: 11 }}>{age(agent.lastActivityAt)}</Text>
      </Pressable>
    </View>);
  }
  if (settings.status !== 'ready') return <View style={{ padding: 12 }}><Text style={muted}>{settings.status === 'loading' ? '正在读取分组…' : `无法读取分组：${settings.error}`}</Text>{settings.status !== 'loading' && action('重试', () => { void settings.reload(); })}</View>;
  const state = settings.values;
  const visibleIds = agents.map(a => a.id);
  const assigned = new Set(state.groups.flatMap(g => g.agentIds));
  const ungrouped = orderedIds(visibleIds.filter(id => !assigned.has(id)), state.ungroupedOrder);
  async function saveName() {
    const name = draft.trim(); if (!name) return;
    const id = `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const ok = await commit(s => editing === 'new' ? { ...s, groups: [...s.groups, { id, name, agentIds: [] }] } : { ...s, groups: s.groups.map(g => g.id === editing ? { ...g, name } : g) });
    if (ok) { setEditing(null); setDraft(''); }
  }
  return <View style={{ backgroundColor: c.surface0, ...(sidebar ? {} : { flex: 1 }), width: '100%', minWidth: 0, alignSelf: 'stretch', paddingVertical: 4, paddingHorizontal: sidebar ? 0 : 8 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingLeft: 6, gap: 4 }}>
      <Text style={{ ...label, fontSize: 16, fontWeight: '600', flex: 1, minWidth: 70 }}>对话文件夹</Text>
      {action('新建文件夹', () => { setEditing('new'); setDraft(''); })}
      {action(tools ? '收起整理工具' : '整理文件夹', () => { setTools(v => !v); setMenu(null); setQuery(''); cancelDrag(); })}
    </View>
    {!sidebar && <Text style={{ ...muted, fontSize: 12, paddingHorizontal: 6, paddingVertical: 8 }}>点文件夹名称展开；点右侧 ＋ 加入已有对话。需要移动或排序时，再打开“整理文件夹”。</Text>}
    {tools && <View style={{ gap: 4, marginBottom: 6 }}>
      <View style={{ flexDirection: 'row' }}>{action(state.mode === 'folders' ? '模式：折叠列表' : '模式：分割线', () => { void commit(s => ({ ...s, mode: s.mode === 'folders' ? 'dividers' : 'folders' })); })}{action('完成整理', () => { setTools(false); setQuery(''); cancelDrag(); })}</View>
      <TextInput accessibilityLabel="搜索对话" value={query} onChangeText={setQuery} placeholder="搜索对话" placeholderTextColor={c.foregroundMuted} style={{ ...label, padding: 8, borderWidth: 1, borderColor: c.border, borderRadius: 6 }} />
    </View>}
    {editing && <View style={{ paddingVertical: 6, gap: 4 }}><TextInput autoFocus accessibilityLabel="分组名称" value={draft} maxLength={60} onChangeText={setDraft} onSubmitEditing={() => { void saveName(); }} placeholder="文件夹名称" placeholderTextColor={c.foregroundMuted} style={{ ...label, padding: 8, borderWidth: 1, borderColor: c.accent, borderRadius: 6 }} /><View style={{ flexDirection: 'row' }}>{action('保存', () => { void saveName(); }, { disabled: !draft.trim() })}{action('取消', () => setEditing(null))}</View></View>}
    {selected && <View style={{ padding: 8, backgroundColor: c.surface2, borderRadius: 6 }}><Text style={{ ...muted, fontSize: 11 }}>{selected.kind === 'agent' ? '拖到目标位置，或点击文件夹移入' : '拖动分组排序，也可在 ⋮ 菜单中上移或下移'}</Text>{action('取消移动', cancelDrag)}</View>}
    {(notice || settings.saveError || listError) && <View style={{ padding: 8 }}><Text style={{ ...label, color: c.statusDanger }}>{notice || settings.saveError || listError}</Text>{action('刷新', () => { setNotice(null); void settings.reload(); })}</View>}
    <ScrollView scrollEnabled={!dragging.current} style={sidebar ? { maxHeight: 430, flexGrow: 0, flexShrink: 1, width: '100%' } : { flex: 1 }} onScrollBeginDrag={() => { boxes.current = []; }}>
      {state.groups.map((group, index) => {
        const ids = group.agentIds.filter(id => visibleIds.includes(id));
        const shut = state.mode === 'folders' && !expanded.has(group.id) && !query;
        return <View key={group.id} style={{ marginBottom: 4 }}>
          {targetView({ key: `group:${group.id}`, groupId: group.id, groupHeader: true }, sidebar && !tools && !selected ? <SidebarRow
            id={`folder-${group.id}`} label={group.name}
            icon={state.mode === 'folders' ? (shut ? 'ChevronRight' : 'ChevronDown') : 'Minus'}
            onPress={() => toggle(group.id)}
            trailing={<View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
              {action(`添加对话到 ${group.name}`, () => { setPicker(picker === group.id ? null : group.id); setMenu(null); setQuery(''); }, { glyph: '+' })}
              {action(`${group.name} 的菜单`, () => { setMenu(menu === group.id ? null : group.id); setPicker(null); }, { glyph: '⋮' })}
            </View>}
          /> : <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: state.mode === 'folders' ? c.surface1 : undefined, borderRadius: 10, minHeight: rowHeight + 4 }}>
            {tools && <Grip color={c.foregroundMuted} cancel={cancelDrag} label={`排序分组 ${group.name}`} begin={() => start({ kind: 'group', id: group.id })} hover={hover} finish={drop} select={() => setSelected({ kind: 'group', id: group.id })} />}
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: !shut }} accessibilityLabel={`${group.name}，${ids.length} 个对话`} onPress={() => { if (selected?.kind === 'agent') destinationPress(group.id); else toggle(group.id); }} style={{ flex: 1, minHeight: rowHeight + 4, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 8, minWidth: 0 }}>
              {state.mode === 'folders' && <Text style={{ ...muted, fontSize: 19, width: 12 }}>{shut ? '›' : '⌄'}</Text>}
              <Text numberOfLines={1} style={{ ...muted, fontSize: 14, flex: 1, minWidth: 0 }}>{group.name}</Text>
              {state.mode === 'dividers' && <View style={{ height: 1, backgroundColor: c.border, flex: 1 }} />}
            </Pressable>
            {action(`添加对话到 ${group.name}`, () => { setPicker(picker === group.id ? null : group.id); setMenu(null); setQuery(''); }, { glyph: '+' })}
            {action(`${group.name} 的菜单`, () => { setMenu(menu === group.id ? null : group.id); setPicker(null); }, { glyph: '⋮' })}
          </View>)}
          {menu === group.id && <View style={{ padding: 6, marginTop: 3, backgroundColor: c.surface1, borderRadius: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {action('重命名', () => { setEditing(group.id); setDraft(group.name); setMenu(null); })}
              {action('上移', () => { if (index > 0) void commit(s => moveGroup(s, group.id, state.groups[index - 1].id)); }, { disabled: index === 0 })}
              {action('下移', () => { if (index < state.groups.length - 1) void commit(s => moveGroup(s, state.groups[index + 1].id, group.id)); }, { disabled: index === state.groups.length - 1 })}
              {action('拖拽整理', () => { setTools(true); setMenu(null); })}
              {action('删除文件夹', () => { void commit(s => removeGroup(s, group.id)); setMenu(null); }, { danger: true })}
            </View><Text style={{ ...muted, fontSize: 11, padding: 6 }}>删除文件夹只取消归类，不删除对话。</Text>
          </View>}
          {picker === group.id && <View style={{ marginVertical: 4, padding: 8, backgroundColor: c.surface1, borderRadius: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ ...muted, flex: 1, fontSize: 11 }}>选择已有对话加入</Text>{action('关闭选择', () => { setPicker(null); setQuery(''); })}</View>
            <TextInput accessibilityLabel="搜索可添加的对话" placeholder="搜索对话" placeholderTextColor={c.foregroundMuted} value={query} onChangeText={setQuery} style={{ ...label, padding: 8, borderWidth: 1, borderColor: c.border, borderRadius: 6 }} />
            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
              {agents.filter(a => !group.agentIds.includes(a.id) && (!query || (a.title ?? a.cwd).toLocaleLowerCase().includes(query.toLocaleLowerCase()))).map(agent => <Pressable key={agent.id} accessibilityRole="button" accessibilityLabel={`添加 ${agent.title ?? '未命名对话'}`} disabled={settings.saving} onPress={() => { void commit(s => moveAgent(s, agent.id, group.id)).then(ok => { if (ok) setExpanded(previous => new Set([...previous, group.id])); }); }} style={{ minHeight: rowHeight, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ ...muted, fontSize: 18 }}>+</Text><Text numberOfLines={1} style={{ ...label, flex: 1 }}>{agent.title || '未命名对话'}</Text></Pressable>)}
              {agents.every(a => group.agentIds.includes(a.id)) && <Text style={{ ...muted, padding: 8 }}>没有可添加的对话</Text>}
            </ScrollView>
          </View>}
          {!shut && ids.map(id => agentRow(id, group.id))}
          {!shut && ids.length === 0 && <Pressable accessibilityRole="button" accessibilityLabel={`添加首个对话到 ${group.name}`} onPress={() => setPicker(group.id)} style={{ paddingLeft: 34, paddingVertical: 12 }}><Text style={{ ...muted, fontSize: 12 }}>点击 ＋ 添加对话</Text></Pressable>}
        </View>;
      })}
      {state.groups.length === 0 && !editing && <Pressable accessibilityRole="button" accessibilityLabel="创建第一个文件夹" onPress={() => { setEditing('new'); setDraft(''); }} style={{ padding: 12 }}><Text style={muted}>＋ 新建文件夹</Text></Pressable>}
      {(!sidebar || tools || selected?.kind === 'agent') && <View>
        {targetView({ key: 'ungrouped', groupId: null }, <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded.has('ungrouped') }} accessibilityLabel="未分组对话" onPress={() => { if (selected?.kind === 'agent') destinationPress(null); else toggle('ungrouped'); }} style={{ marginTop: 8, paddingHorizontal: 12, minHeight: rowHeight, justifyContent: 'center', borderTopWidth: 1, borderTopColor: c.border }}><Text style={muted}>{expanded.has('ungrouped') ? '⌄' : '›'} 未分组 · {ungrouped.length}</Text></Pressable>)}
        {(expanded.has('ungrouped') || !!query) && ungrouped.map(id => agentRow(id, null))}
      </View>}
      {loading && <Text style={{ ...muted, padding: 12 }}>正在读取对话…</Text>}
      {query && !agents.some(a => (a.title ?? a.cwd).toLocaleLowerCase().includes(query.toLocaleLowerCase())) && <Text style={{ ...muted, padding: 12 }}>没有匹配的对话</Text>}
    </ScrollView>
  </View>;
}
