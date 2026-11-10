import type { PluginWorkspacePanelProps } from '@getpaseo/plugin/client';
import { useSettings, useTabState, useWorkspace } from '@getpaseo/plugin/client';
import { Icon } from '@getpaseo/plugin/client/ui';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { organization } from '../shared/settings';
import { moveAgent } from '../shared/model';
import { Organizer } from './organizer';
import { useConversations, type Conversation } from './use-agents';

const viewSchema = z.object({ density: z.enum(['compact', 'detailed']), folder: z.string(), scope: z.enum(['workspace', 'host']) });
const defaults = { density: 'compact' as const, folder: 'all', scope: 'workspace' as const };

function HoverSurface({ children, background, highlight, selected, reducedMotion }: { children: ReactNode; background: string; highlight: string; selected?: boolean; reducedMotion: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const animation = Animated.timing(opacity, { toValue: hovered || selected ? 1 : 0, duration: reducedMotion ? 0 : 140, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [hovered, selected, reducedMotion, opacity]);
  return <View onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} style={{ position: 'relative', backgroundColor: background, borderRadius: 8, overflow: 'hidden', minWidth: 0 }}>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: highlight, opacity }} />
    {children}
  </View>;
}

export function ConversationPanel(props: PluginWorkspacePanelProps) {
  const { theme, layout, workspaceId, navigation, host, tab } = props;
  const c = theme.colors;
  const settings = useSettings(organization);
  const { agents, loading, error } = useConversations();
  const workspace = useWorkspace(workspaceId, w => ({ title: w.title ?? w.name }));
  const [view, setView] = useTabState(tab, viewSchema, defaults);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [manage, setManage] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(true);
  const pending = useRef(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReducedMotion(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { live = false; listener.remove(); };
  }, []);
  const body = { color: c.foreground, fontSize: 13, lineHeight: 19 };
  const muted = { ...body, color: c.foregroundMuted, fontSize: 11 };
  function button(text: string, onPress: () => void, active = false, disabled = false) {
    return <Pressable accessibilityRole="button" accessibilityLabel={text} accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: layout.compact ? 40 : 32, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 6, backgroundColor: active || pressed ? c.surface2 : 'transparent', opacity: disabled ? 0.45 : 1 })}><Text style={{ ...muted, color: active ? c.foreground : c.foregroundMuted }}>{text}</Text></Pressable>;
  }
  if (manage) return <View style={{ flex: 1, minWidth: 0, backgroundColor: c.surface0 }}><View style={{ padding: 8 }}>{button('返回对话列表', () => setManage(false))}</View><Organizer {...props} onOpen={id => navigation?.openAgent({ agentId: id, serverId: host.id })} /></View>;
  if (settings.status !== 'ready') return <View style={{ padding: 16, backgroundColor: c.surface0 }}><Text style={body}>{settings.status === 'loading' ? '正在读取文件夹…' : settings.error}</Text>{settings.status !== 'loading' && button('重试', () => { void settings.reload(); })}</View>;
  const state = settings.values;
  const folderId = state.groups.some(g => g.id === view.folder) || view.folder === 'ungrouped' ? view.folder : 'all';
  const group = state.groups.find(g => g.id === folderId);
  const scoped = agents.filter(a => view.scope === 'host' || a.workspaceId === workspaceId);
  const assigned = new Set(state.groups.flatMap(g => g.agentIds));
  const belongs = (a: Conversation) => folderId === 'all' || (folderId === 'ungrouped' ? !assigned.has(a.id) : !!group?.agentIds.includes(a.id));
  const matches = (a: Conversation) => !query || `${a.title ?? ''} ${a.cwd}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const conversations = scoped.filter(a => belongs(a) && matches(a));
  if (group) conversations.sort((a, b) => group.agentIds.indexOf(a.id) - group.agentIds.indexOf(b.id));
  const candidates = scoped.filter(a => !group?.agentIds.includes(a.id) && matches(a));
  const folders = [{ id: 'all', name: '全部', count: scoped.length }, ...state.groups.map(g => ({ id: g.id, name: g.name, count: scoped.filter(a => g.agentIds.includes(a.id)).length })), { id: 'ungrouped', name: '未分组', count: scoped.filter(a => !assigned.has(a.id)).length }];
  async function createFolder() {
    const name = draft.trim(); if (!name || settings.status !== 'ready' || pending.current) return;
    const id = `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    pending.current = true;
    try {
      if (await settings.save({ ...settings.values, groups: [...settings.values.groups, { id, name, agentIds: [] }] }, settings.revision)) { setView({ ...view, folder: id }); setDraft(''); setCreating(false); }
    } finally { pending.current = false; }
  }
  async function add(id: string) {
    if (!group || pending.current || settings.status !== 'ready') return;
    pending.current = true;
    try { await settings.save(moveAgent(settings.values, id, group.id), settings.revision); }
    finally { pending.current = false; }
  }
  function row(agent: Conversation, picking = false) {
    const detail = view.density === 'detailed';
    const status = agent.status === 'running' ? '运行中' : agent.status === 'error' ? '出错' : '空闲';
    const statusColor = agent.status === 'running' ? c.statusSuccess : agent.status === 'error' ? c.statusDanger : c.foregroundMuted;
    return <HoverSurface key={agent.id} background={c.surface0} highlight={c.surface2} selected={!picking && opened === agent.id} reducedMotion={reducedMotion}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${picking ? '加入' : '打开'} ${agent.title || '未命名对话'}`} disabled={picking ? settings.saving : !navigation} onPress={() => { if (picking) void add(agent.id); else { setOpened(agent.id); navigation?.openAgent({ agentId: agent.id, serverId: host.id }); } }} style={{ minHeight: detail ? 78 : layout.compact ? 46 : 40, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: detail ? 12 : 6, minWidth: 0 }}>
        <Icon name={picking ? 'Plus' : 'MessageCircle'} size={15} color={statusColor} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text numberOfLines={detail ? 3 : 1} style={body}>{agent.title || '未命名对话'}</Text>
          {detail && <Text numberOfLines={1} style={muted}>{agent.cwd}</Text>}
          {detail && <Text style={{ ...muted, color: statusColor }}>{status}{agent.lastActivityAt ? ` · ${new Date(agent.lastActivityAt).toLocaleDateString()}` : ''}</Text>}
        </View>
        {!detail && <Text style={{ ...muted, color: statusColor, flexShrink: 0 }}>{status}</Text>}
      </Pressable>
    </HoverSurface>;
  }
  return <View style={{ flex: 1, minWidth: 0, backgroundColor: c.surface0 }}>
    <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
        <Text numberOfLines={1} style={{ ...body, fontWeight: '600', flex: 1, minWidth: 80 }}>{workspace?.title || '对话文件夹'}</Text>
        {button('精简', () => setView({ ...view, density: 'compact' }), view.density === 'compact')}
        {button('多行', () => setView({ ...view, density: 'detailed' }), view.density === 'detailed')}
        {button('整理', () => setManage(true))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
        {button('当前工作区', () => setView({ ...view, scope: 'workspace' }), view.scope === 'workspace')}
        {button('当前主机全部对话', () => setView({ ...view, scope: 'host' }), view.scope === 'host')}
        {button('新建文件夹', () => setCreating(v => !v))}
        {group && button(adding ? '完成添加' : '添加对话', () => { setAdding(v => !v); setQuery(''); }, adding)}
      </View>
      <TextInput accessibilityLabel="搜索对话" placeholder="搜索对话" placeholderTextColor={c.foregroundMuted} value={query} onChangeText={setQuery} style={{ ...body, borderWidth: 1, borderColor: c.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7, minWidth: 0 }} />
      {creating && <View style={{ gap: 4 }}><TextInput autoFocus accessibilityLabel="新文件夹名称" placeholder="文件夹名称" placeholderTextColor={c.foregroundMuted} maxLength={60} value={draft} onChangeText={setDraft} onSubmitEditing={() => { void createFolder(); }} style={{ ...body, borderWidth: 1, borderColor: c.accent, borderRadius: 6, padding: 8 }} /><View style={{ flexDirection: 'row' }}>{button('创建', () => { void createFolder(); }, false, !draft.trim() || settings.saving)}{button('取消', () => setCreating(false))}</View></View>}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, borderBottomWidth: 1, borderBottomColor: c.border }} contentContainerStyle={{ paddingHorizontal: 8, gap: 4, paddingVertical: 6 }}>
      {folders.map(folder => <HoverSurface key={folder.id} background={c.surface0} highlight={c.surface2} selected={folderId === folder.id} reducedMotion={reducedMotion}>
        <Pressable accessibilityRole="tab" accessibilityLabel={`文件夹 ${folder.name}`} accessibilityState={{ selected: folderId === folder.id }} onPress={() => { setView({ ...view, folder: folder.id }); setAdding(false); setQuery(''); }} style={{ minHeight: 36, maxWidth: view.density === 'compact' ? 150 : 250, minWidth: 64, paddingHorizontal: 12, paddingVertical: 7, borderBottomWidth: 2, borderBottomColor: folderId === folder.id ? c.accent : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text numberOfLines={view.density === 'compact' ? 1 : 2} style={{ ...body, flexShrink: 1, color: folderId === folder.id ? c.foreground : c.foregroundMuted }}>{folder.name}</Text>
          <Text style={muted}>{folder.count}</Text>
        </Pressable>
      </HoverSurface>)}
    </ScrollView>
    {(settings.saveError || error) && <View style={{ padding: 12 }}><Text style={{ ...body, color: c.statusDanger }}>{settings.saveError || error}</Text>{button('重新读取分组', () => { void settings.reload(); })}</View>}
    {!navigation && <Text style={{ ...muted, padding: 12 }}>当前客户端无法打开对话，请更新客户端。</Text>}
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 8, gap: 3 }}>
      {adding && group ? <><Text style={{ ...muted, padding: 8 }}>选择对话加入「{group.name}」。只改变分组，不移动工作目录。</Text>{candidates.map(a => row(a, true))}{candidates.length === 0 && <Text style={{ ...muted, padding: 12 }}>没有可添加的对话</Text>}</> : <>{conversations.map(a => row(a))}{!loading && conversations.length === 0 && <View style={{ padding: 16, gap: 6 }}><Text style={body}>这里还没有对话</Text><Text style={muted}>{group ? '点击“添加对话”，选择已有对话加入这个文件夹。' : view.scope === 'workspace' ? '可切换“当前主机全部对话”查看其他工作区的对话。' : '新对话会显示在这里。'}</Text></View>}</>}
      {loading && <Text style={{ ...muted, padding: 12 }}>正在读取对话…</Text>}
    </ScrollView>
  </View>;
}
