import type { AgentRef, PluginSidebarViewProps } from '@getpaseo/plugin/client';
import { useAgent, useAgents, useHosts, useSettings, useRpc } from '@getpaseo/plugin/client';
import { Icon } from '@getpaseo/plugin/client/ui';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { organization, hostOrganizations } from '../shared/settings';
import { hostContext } from '../shared/host-context';
import { moveAgent, removeGroup, moveGroup } from '../shared/model';

function ConversationRow({ reference, view, select, moving, detailed }: { reference: AgentRef; view: PluginSidebarViewProps; select(id: string): void; moving: boolean; detailed?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const agent = useAgent(reference, a => ({ title: a.title, status: a.status }));
  if (!agent) return null;
  const c = view.theme.colors;
  return <View onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} style={{ flexDirection: 'row', alignItems: 'center', minWidth: 0, backgroundColor: hovered ? c.surface2 : undefined, borderRadius: 6 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${agent.title ?? 'Untitled conversation'}`} onPress={() => view.navigation.openAgent(reference)} onLongPress={() => select(reference.id)} style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: view.layout.compact ? 44 : 32, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: pressed || view.active.agent?.key === reference.key ? c.surface2 : undefined, borderRadius: 6 })}>
      <Text style={{ color: agent.status === 'running' ? c.statusSuccess : c.foregroundMuted, fontSize: 8 }}>●</Text>
      <Text numberOfLines={detailed ? 3 : 1} style={{ color: c.foreground, fontSize: 12, lineHeight: 18, flex: 1, paddingVertical: detailed ? 8 : 0 }}>{agent.title || 'Untitled conversation'}</Text>
    </Pressable>
    {moving && <Pressable accessibilityRole="button" accessibilityLabel={`Move ${agent.title ?? 'Untitled conversation'}`} onPress={() => select(reference.id)} style={{ padding: 8 }}><Icon name="Move" size={14} color={c.foregroundMuted} /></Pressable>}
  </View>;
}

export function FolderSidebar(view: PluginSidebarViewProps) {
  const settings = useSettings(organization);
  const extraSettings = useSettings(hostOrganizations);
  const readHostContext = useRpc(hostContext);
  const [ownerHost, setOwnerHost] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [pickedHost, setPickedHost] = useState<string | null>(null);
  const pending = useRef(false);
  useEffect(() => { let active = true; void readHostContext({}).then(result => { if (active) setOwnerHost(result.hostId); }).catch(error => { if (active) setContextError(String(error)); }); return () => { active = false; }; }, [readHostContext]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['ungrouped']));
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [detailed, setDetailed] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const c = view.theme.colors;
  const hosts = useHosts();
  const targetHost = pickedHost && hosts.some(h => h.serverId === pickedHost) ? pickedHost : ownerHost;
  const onlyHost = targetHost;
  const agents = useAgents({ hosts: onlyHost ? [onlyHost] : [], orderBy: ['lastActivityAt', 'desc'] });
  const visible = agents;
  const button = (label: string, press: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={press} style={{ padding: 8 }}><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>{label}</Text></Pressable>;
  if (!ownerHost) return <Text style={{ color: c.foregroundMuted, padding: 12 }}>{contextError || 'Loading host…'}</Text>;
  if (targetHost !== ownerHost && extraSettings.status !== 'ready') return <Text style={{ color: c.foregroundMuted, padding: 12 }}>{extraSettings.status === 'loading' ? 'Loading host folders…' : extraSettings.error}</Text>;
  if (settings.status !== 'ready') return <View style={{ padding: 12 }}><Text style={{ color: c.foregroundMuted }}>{settings.status === 'loading' ? 'Loading folders…' : settings.error}</Text></View>;
  const state = targetHost === ownerHost ? settings.values : extraSettings.status === 'ready' ? (extraSettings.values.hosts[targetHost!] ?? { mode: 'folders' as const, groups: [], ungroupedOrder: [] }) : settings.values;
  async function save(next: typeof state): Promise<boolean> {
    if (pending.current) return false;
    pending.current = true;
    try {
      if (targetHost === ownerHost && settings.status === 'ready') return await settings.save(next, settings.revision);
      if (targetHost && extraSettings.status === 'ready') return await extraSettings.save({ hosts: { ...extraSettings.values.hosts, [targetHost]: next } }, extraSettings.revision);
      return false;
    } finally { pending.current = false; }
  }
  const assigned = new Set(state.groups.flatMap(g => g.agentIds));
  function toggle(id: string) { setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  async function create() {
    const name = draft.trim(); if (!name || settings.status !== 'ready') return;
    const id = `group-${Date.now().toString(36)}`;
    const groups = renaming ? state.groups.map(g => g.id === renaming ? { ...g, name } : g) : [...state.groups, { id, name, agentIds: [] }];
    if (await save({ ...state, groups })) { setDraft(''); setEditing(false); setRenaming(null); }
  }
  return <ScrollView style={{ flex: 1, backgroundColor: c.surface0 }} contentContainerStyle={{ padding: 10, gap: 6 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={{ color: c.foreground, fontSize: 13, fontWeight: '600' }}>Conversation folders</Text><Text style={{ color: c.foregroundMuted, fontSize: 10, marginTop: 2 }}>Keep active chats within reach</Text></View>{button('New folder', () => { setRenaming(null); setDraft(''); setEditing(v => !v); })}{button(detailed ? 'Comfortable' : 'Compact', () => setDetailed(v => !v))}{button(selected !== null ? '完成Organize' : 'Organize', () => setSelected(selected !== null ? null : ''))}</View>
    {hosts.length > 1 && <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{hosts.map(host => <Pressable key={host.serverId} accessibilityRole="button" accessibilityLabel={`Select host ${host.label}`} onPress={() => { setPickedHost(host.serverId); setSelected(null); setEditing(false); setDraft(''); setExpanded(new Set(['ungrouped'])); setPicker(null); setMenu(null); setRenaming(null); }} style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, backgroundColor: targetHost === host.serverId ? c.surface2 : undefined }}><Text style={{ color: c.foregroundMuted, fontSize: 11 }}>{host.label}{host.status === 'offline' || host.status === 'error' ? ' (offline)' : ''}</Text></Pressable>)}</View>}
    {editing && <View><TextInput accessibilityLabel="Folder name" value={draft} onChangeText={setDraft} placeholder="Folder name" placeholderTextColor={c.foregroundMuted} maxLength={60} style={{ color: c.foreground, borderWidth: 1, borderColor: c.border, padding: 8 }} />{button(renaming ? 'Save' : 'Create', () => { void create(); })}{button('Cancel', () => { setEditing(false); setRenaming(null); })}</View>}
    {selected && <Text style={{ color: c.foregroundMuted, fontSize: 11, padding: 8 }}>Choose a folder for the selected conversation</Text>}
    {[...state.groups, { id: 'ungrouped', name: 'Unfiled', agentIds: visible.filter(a => !assigned.has(a.id)).map(a => a.id) }].map(group => {
      const rows = group.agentIds.flatMap(id => visible.filter(a => a.id === id));
      const open = expanded.has(group.id);
      return <View key={group.id}>
        <View onPointerEnter={() => setHoveredGroup(group.id)} onPointerLeave={() => setHoveredGroup(null)} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 8, backgroundColor: hoveredGroup === group.id ? c.surface2 : c.surface1 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Folder ${group.name}`} accessibilityState={{ expanded: open }} onPress={() => { if (selected) void save(moveAgent(state, selected, group.id === 'ungrouped' ? null : group.id)).then(ok => { if (ok) setSelected(null); }); else toggle(group.id); }} style={({ pressed }) => ({ minHeight: view.layout.compact ? 44 : 36, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 8, flex: 1, minWidth: 0, backgroundColor: pressed ? c.surface2 : 'transparent', borderWidth: open ? 1 : 0, borderColor: c.border })}>
          <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={14} color={c.foregroundMuted} /><Text numberOfLines={1} style={{ color: c.foreground, fontSize: 12, fontWeight: '600', flex: 1 }}>{group.name}</Text><Text style={{ color: c.foregroundMuted, fontSize: 11 }}>{rows.length}</Text>
        </Pressable>
        {group.id !== 'ungrouped' && <>{button(`＋`, () => { setPicker(picker === group.id ? null : group.id); setMenu(null); })}{button('⋮', () => { setMenu(menu === group.id ? null : group.id); setPicker(null); })}</>}
        </View>
        {menu === group.id && <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 4, backgroundColor: c.surface1 }}>
          {button('Rename', () => { setRenaming(group.id); setDraft(group.name); setEditing(true); setMenu(null); })}
          {button('Move up', () => { const index = state.groups.findIndex(g => g.id === group.id); if (index > 0) void save(moveGroup(state, group.id, state.groups[index - 1].id)); })}
          {button('Delete folder', () => { void save(removeGroup(state, group.id)); setMenu(null); })}
        </View>}
        {picker === group.id && <View style={{ padding: 6, backgroundColor: c.surface1 }}>
          <Text style={{ color: c.foregroundMuted, fontSize: 11, padding: 6 }}>Add conversations to this folder</Text>
          {visible.filter(a => !group.agentIds.includes(a.id)).map(reference => <AddConversation key={reference.key} reference={reference} view={view} add={() => { void save(moveAgent(state, reference.id, group.id)).then(ok => { if (ok) { setPicker(null); setExpanded(previous => new Set([...previous, group.id])); } }); }} />)}
          {button('Close', () => setPicker(null))}
        </View>}
        {open && rows.map(reference => <ConversationRow key={reference.key} reference={reference} view={view} moving={selected !== null} detailed={detailed} select={setSelected} />)}
      </View>;
    })}
    {(settings.saveError || extraSettings.saveError) && <Text style={{ color: c.statusDanger, padding: 8 }}>{settings.saveError || extraSettings.saveError}</Text>}
  </ScrollView>;
}

function AddConversation({ reference, view, add }: { reference: AgentRef; view: PluginSidebarViewProps; add(): void }) {
  const title = useAgent(reference, agent => agent.title);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Add ${title || 'Untitled conversation'}`} onPress={add} style={{ minHeight: 36, padding: 8 }}><Text numberOfLines={2} style={{ color: view.theme.colors.foreground, fontSize: 12 }}>＋ {title || 'Untitled conversation'}</Text></Pressable>;
}
