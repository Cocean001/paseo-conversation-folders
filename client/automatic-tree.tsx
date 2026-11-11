import { conversationState, aggregateStates } from '../shared/status';
import { ConversationDropTarget, type ConversationDestination } from './drag-and-drop';
import { ConversationViewContext, useConversationView } from './conversation-view';
import { conversationOrder, matchesConversation, defaultConversationOptions, type ConversationOptions } from '../shared/conversations';
import { ContextMenu, type MenuAction, type MenuPoint } from './context-menu';
import { memberRef, memberId, containsMember, type Group } from '../shared/model';
import { pickIconImage } from './image-picker';
import { TextInput } from '@getpaseo/plugin/client/ui';
import { FeedbackPressable as Pressable, Glyph, Reveal, Disclosure, StatusMark, EntryReveal, ActionRow, BranchIcon, FolderArrival } from './visuals';
import { projectAppearance } from '../shared/settings';
import { useEffect, useRef, useState } from 'react';
import { Text, View, Image, Modal, ScrollView } from 'react-native';
import { useSettings, useAgents, useWorkspaces, useWorkspace, type AgentRef, type WorkspaceRef, type PluginSidebarViewProps } from '@getpaseo/plugin/client';
import type { ReactNode } from 'react';
type FolderAction = (hostId: string, group: Group, action: 'rename' | 'child' | 'delete') => void;

function Branch({ title, children, view, icon = 'project', action, color, image, onEdit, editor, state, hasUpdates = false, hoverAction = false, actionOpen = false, menuActions = [], destination }: { destination?: ConversationDestination; menuActions?: readonly MenuAction[]; hoverAction?: boolean; actionOpen?: boolean; state?: string; hasUpdates?: boolean; editor?: ReactNode; color?: string; image?: string; onEdit?: () => void; action?: ReactNode; icon?: 'server' | 'project' | 'folder' | 'code' | 'globe' | 'star' | 'book'; title: string; children: ReactNode; view: PluginSidebarViewProps }) {
  const { options } = useConversationView();
  const [open, setOpen] = useState(!options.allCollapsed);
  const openBeforeCollapse = useRef(true);
  const lastCollapseVersion = useRef(options.collapseVersion);
  useEffect(() => {
    if (lastCollapseVersion.current === options.collapseVersion) return;
    lastCollapseVersion.current = options.collapseVersion;
    if (options.allCollapsed) { openBeforeCollapse.current = open; setOpen(false); }
    else setOpen(openBeforeCollapse.current);
  }, [options.collapseVersion, options.allCollapsed, open]);
  const [menuPoint, setMenuPoint] = useState<MenuPoint | null>(null);
  const rowRef = useRef<View>(null);
  const branchRow = <ActionRow theme={view.theme} active={actionOpen} compact={view.layout.compact} persistent={!hoverAction || actionOpen} action={action}>
    <Pressable theme={view.theme} hoverBackground="transparent" {...(view.layout.platform === 'web' ? { onContextMenu: (event: { preventDefault(): void; stopPropagation(): void; clientX: number; clientY: number }) => { event.preventDefault(); event.stopPropagation(); setMenuPoint({ x: event.clientX, y: event.clientY }); } } : {})} focusRef={rowRef} onLongPress={() => { rowRef.current?.measureInWindow((x,y,width,height) => setMenuPoint({x:x+width/2,y:y+height})); }} {...{ onKeyDown: (event: { key: string; shiftKey: boolean; preventDefault(): void }) => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); rowRef.current?.measureInWindow((x,y,width,height) => setMenuPoint({x:x+width/2,y:y+height})); } } }} accessibilityRole="button" accessibilityLabel={`Toggle ${title}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ flex: 1, minWidth: 0, minHeight: view.layout.compact ? 44 : 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 }}>
      <Disclosure open={open} color={view.theme.colors.foregroundMuted} /><BranchIcon loadingColor={options.loadingColor} loadingEffect={options.loadingEffect} state={state} hasUpdates={hasUpdates} open={open} icon={icon} image={image} color={color} theme={view.theme} />
      <Text numberOfLines={1} style={{ color: view.theme.colors.foreground, fontSize: 12, fontWeight: '500', flex: 1, minWidth: 0 }}>{title}</Text>
    </Pressable></ActionRow>;
  const branch = <View style={{ minWidth: 0, maxWidth: '100%' }}>
    {destination && destination.groupId === null && !destination.projectKey ? <ConversationDropTarget destination={destination} view={view} activate={() => setOpen(true)}>{branchRow}</ConversationDropTarget> : branchRow}
    <ContextMenu anchor={menuPoint} close={() => setMenuPoint(null)} view={view} actions={[...menuActions, ...(onEdit ? [{ id: 'appearance', label: 'Name, icon & color…', onSelect: onEdit }] : []), { id: 'toggle', label: open ? 'Collapse' : 'Expand', onSelect: () => setOpen(!open) }]} />
    {editor}
    <Reveal open={open}><View style={{ marginLeft: 12, minWidth: 0 }}>{children}</View></Reveal>
  </View>;
  return destination && (destination.groupId !== null || destination.projectKey) ? <ConversationDropTarget destination={destination} view={view} activate={() => setOpen(true)}>{branch}</ConversationDropTarget> : branch;
}
function ProjectBranch({ reference, workspaceKeys, view, row, excluded = new Set<string>() }: { excluded?: Set<string>; reference: WorkspaceRef; workspaceKeys: Set<string>; view: PluginSidebarViewProps; row(ref: AgentRef, groupId: string | null, folderHostId?: string): ReactNode }) {
  const { options, unfiledOrder, foldersForHost } = useConversationView();
  const workspace = useWorkspace(reference);
  const settings = useSettings(projectAppearance);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<'project' | 'folder' | 'code' | 'globe' | 'star' | 'book'>('project');
  const [color, setColor] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const projectFolder = foldersForHost(reference.hostId).find(group => group.projectKey === workspace?.project.key);
  const memberHosts = projectFolder?.agentIds.map(id => memberRef(reference.hostId, id).hostId) ?? [];
  const agents = useAgents({ hosts: [...new Set([reference.hostId, ...memberHosts])], where: a => ((workspaceKeys.has(a.workspace.key) && !excluded.has(`${a.hostId}:${a.id}`)) || !!projectFolder && containsMember(projectFolder.agentIds, reference.hostId, a.hostId, a.id)) && matchesConversation(a, options), orderBy: conversationOrder(options, projectFolder?.agentIds ?? unfiledOrder(reference.hostId), reference.hostId) });
  const agentStates = useAgents({ hosts: [...new Set([reference.hostId, ...memberHosts])], where: agent => (!options.members || options.members.some(member => member.hostId === agent.hostId && member.agentId === agent.id)) && ((workspaceKeys.has(agent.workspace.key) && !excluded.has(`${agent.hostId}:${agent.id}`)) || !!projectFolder && containsMember(projectFolder.agentIds, reference.hostId, agent.hostId, agent.id)), groupBy: agent => conversationState(agent) });
  const projectStatus = aggregateStates(agentStates.map(group => group.key));
  const key = workspace?.project.key;
  const appearance = settings.status === 'ready' && key ? settings.values.projects[key] : undefined;
  const title = appearance?.name || workspace?.projectDisplayName || 'Project';
  const c = view.theme.colors;
  async function save(reset = false) {
    if (pending.current || settings.status !== 'ready' || !key) return;
    if (!reset && color.trim() && !/^#[0-9a-fA-F]{6}$/.test(color.trim())) { setError('Use a hex color such as #4F86F7, or leave blank for the theme color.'); return; }
    pending.current = true; setSaving(true); setError(null);
    try {
      const projects = { ...settings.values.projects };
      if (reset) delete projects[key]; else projects[key] = { name: name.trim(), icon, ...(color.trim() ? { color: color.trim() } : {}), ...(image ? { image } : {}) };
      if (await settings.save({ projects }, settings.revision)) setEditing(false);
      else setError('Could not save. Try again with the latest settings.');
    } catch { setError('Could not save project appearance. Try again.'); }
    finally { pending.current = false; setSaving(false); }
  }
  const edit = () => { setName(appearance?.name || ''); setIcon(appearance?.icon || 'project'); setColor(appearance?.color || ''); setImage(appearance?.image); setError(null); setEditing(true); };
  return <View style={{ minWidth: 0 }}>
    <Branch destination={key ? { hostId: reference.hostId, groupId: projectFolder?.id ?? null, projectKey: key, projectTitle: title } : undefined} title={title} hoverAction actionOpen={editing} state={projectStatus.state} hasUpdates={projectStatus.hasUpdates} icon={appearance?.icon || 'project'} color={appearance?.color} image={appearance?.image} onEdit={settings.status === 'ready' ? edit : undefined} view={view} action={<Pressable theme={view.theme} hoverBackground="transparent" accessibilityRole="button" accessibilityLabel={`Customize project ${title}`} disabled={settings.status !== 'ready'} accessibilityState={{ expanded: editing }} onPress={() => { if (!saving) { if (editing) setEditing(false); else edit(); } }} style={{ width: view.layout.compact ? 44 : 36, height: view.layout.compact ? 44 : 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}><Glyph name="menu" color={c.foregroundMuted} /></Pressable>} editor={<Modal transparent visible={editing} animationType="fade" onRequestClose={() => { if (!saving) setEditing(false); }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.35)' }} {...{ onKeyDown: (event: { key: string; stopPropagation(): void }) => { if (event.key === 'Escape' && !saving) { event.stopPropagation(); setEditing(false); } } }}>
      <View role="dialog" accessibilityLabel="Project appearance" accessibilityViewIsModal style={{ width: '100%', maxWidth: 420, maxHeight: '90%', borderRadius: 10, backgroundColor: c.surface0, borderWidth: 1, borderColor: c.border, padding: 16 }}>
        <Text style={{ color: c.foreground, fontSize: 15, fontWeight: '600', marginBottom: 16 }}>Project appearance</Text>
        <ScrollView keyboardShouldPersistTaps="handled">
        {editing && <View style={{ gap: 8 }}>
          <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>Display name</Text>
          <TextInput accessibilityLabel="Display name" value={name} onChangeText={value => setName(value.slice(0,60))} placeholder={workspace?.projectDisplayName || 'Project'} placeholderTextColor={c.foregroundMuted} editable={!saving} style={{ color: c.foreground, backgroundColor: c.surface1, borderRadius: 4, paddingHorizontal: 8, minHeight: 36, fontSize: 12 }} />
          <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>Icon</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{(['project','folder','code','globe','star','book'] as const).map(value => <Pressable theme={view.theme} key={value} accessibilityRole="button" accessibilityLabel={`${value} icon`} accessibilityState={{ selected: !image && icon === value }} disabled={saving} onPress={() => { setIcon(value); setImage(undefined); }} style={{ width: view.layout.compact ? 44 : 32, height: view.layout.compact ? 44 : 32, justifyContent: 'center', alignItems: 'center', borderRadius: 4, backgroundColor: !image && icon === value ? c.surface2 : 'transparent' }}><Glyph name={value} color={/^#[0-9a-fA-F]{6}$/.test(color) ? color : c.foregroundMuted} /></Pressable>)}</View>
          <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>Icon color</Text>
          <TextInput accessibilityLabel="Icon color" value={color} onChangeText={setColor} placeholder="Theme default / #4F86F7" placeholderTextColor={c.foregroundMuted} editable={!saving} style={{ color: c.foreground, backgroundColor: c.surface1, borderRadius: 4, paddingHorizontal: 8, minHeight: 36, fontSize: 12 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {image && <Image source={{ uri: image }} style={{ width: 24, height: 24, borderRadius: 3 }} />}
            <Pressable theme={view.theme} accessibilityRole="button" disabled={saving || view.layout.platform !== 'web'} onPress={() => { void pickIconImage().then(value => { if (value) setImage(value); }).catch(reason => setError(String(reason.message))); }} style={{ minHeight: 36, justifyContent: 'center' }}><Text style={{ color: c.foreground, fontSize: 12 }}>Upload image</Text></Pressable>
            {image && <Pressable theme={view.theme} accessibilityRole="button" disabled={saving} onPress={() => setImage(undefined)}><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>Remove</Text></Pressable>}
          </View>
          <Text style={{ color: c.foregroundMuted, fontSize: 10 }}>{view.layout.platform === 'web' ? 'PNG, JPEG, WebP · up to 128 KB' : 'Upload from desktop or web'}</Text>
          {error && <Text accessibilityRole="alert" style={{ color: c.statusDanger, fontSize: 11 }}>{error}</Text>}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Pressable theme={view.theme} accessibilityRole="button" disabled={saving} onPress={() => { void save(true); }} style={{ minHeight: 36, justifyContent: 'center' }}><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>Restore default</Text></Pressable>
            <Pressable theme={view.theme} accessibilityRole="button" disabled={saving} onPress={() => { void save(); }} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 4, backgroundColor: c.surface2, justifyContent: 'center' }}><Text style={{ color: c.foreground, fontSize: 12 }}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
          </View>
        </View>}
        <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel="Close project settings" disabled={saving} onPress={() => setEditing(false)} style={{ minHeight: 36, justifyContent: 'center', alignItems: 'flex-end' }}><Text style={{ color: c.foregroundMuted, fontSize: 12 }}>Close</Text></Pressable>
      </ScrollView></View></View></Modal>}>{agents.length ? agents.map(agent => row(agent, projectFolder?.id ?? null, reference.hostId)) : <Text style={{ color: c.foregroundMuted, paddingVertical: 7, minHeight: 28, paddingHorizontal: 8, fontSize: 10, lineHeight: 14 }}>Empty</Text>}</Branch>
    {settings.status === 'error' && <Text style={{ color: c.statusDanger }}>{settings.error}</Text>}
  </View>;
}
function Projects({ hosts, view, row, excluded = new Set<string>() }: { excluded?: Set<string>; hosts: string[]; view: PluginSidebarViewProps; row(ref: AgentRef, groupId: string | null, folderHostId?: string): ReactNode }) {
  const { options } = useConversationView();
  const tabWorkspaces = useAgents({ hosts, where: agent => !options.members || options.members.some(member => member.hostId === agent.hostId && member.agentId === agent.id), groupBy: agent => agent.workspace.key });
  const tabWorkspaceKeys = new Set(tabWorkspaces.map(group=>group.key));
  const projects = useWorkspaces({ hosts, where: workspace => (!options.members || tabWorkspaceKeys.has(workspace.ref.key)) && (!options.workspaceKeys || options.workspaceKeys.includes(workspace.ref.key)), groupBy: w => ({ key: w.project.key, title: w.projectDisplayName }) });
  if (!projects.length) return <Text style={{ color: view.theme.colors.foregroundMuted, padding: 8, fontSize: 11 }}>No projects</Text>;
  return <>{projects.map(p => p.items[0] && <ProjectBranch key={p.key} reference={p.items[0]} workspaceKeys={new Set(p.items.map(w => w.key))} view={view} row={row} excluded={excluded} />)}</>;
}
function ServerChats({ hostId, row, view, excluded = new Set<string>() }: { excluded?: Set<string>; view: PluginSidebarViewProps; hostId: string; row(ref: AgentRef, groupId: string | null, folderHostId?: string): ReactNode }) {
  const { options, unfiledOrder } = useConversationView();
  const agents = useAgents({ hosts: [hostId], where: a => !excluded.has(`${a.hostId}:${a.id}`) && matchesConversation(a, options), orderBy: conversationOrder(options, unfiledOrder(hostId)) });
  return <>{agents.length ? agents.map(agent => row(agent, null)) : <Text style={{ color: view.theme.colors.foregroundMuted, paddingVertical: 2, paddingHorizontal: 8, fontSize: 10, lineHeight: 14 }}>Empty</Text>}</>;
}
function HostBranch({ host, mode, view, row, createFolder, groups = [], excluded = new Set<string>(), folderAction }: { folderAction?: FolderAction; excluded?: Set<string>; createFolder(hostId: string, name: string): Promise<boolean>; groups?: Group[]; host: {serverId: string; label: string; status?: string}; mode: 'server' | 'server-project'; view: PluginSidebarViewProps; row(ref: AgentRef, groupId: string | null, folderHostId?: string): ReactNode }) {
  const { options } = useConversationView();
  const [adding, setAdding] = useState(false);
  const [hostMenu, setHostMenu] = useState<MenuPoint | null>(null);
  const moreRef = useRef<View>(null);
  const [path, setPath] = useState('');
  const [focused, setFocused] = useState(false);
  const nameInput = useRef<import('react-native').TextInput>(null);
  useEffect(() => { if (adding) nameInput.current?.focus(); else nameInput.current?.blur(); }, [adding]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const c = view.theme.colors;
  const available = !host.status || host.status === 'online';
  const members = groups.flatMap(group => group.agentIds);
  const states = useAgents({ where: agent => (!options.members || options.members.some(member => member.hostId === agent.hostId && member.agentId === agent.id)) && (agent.hostId === host.serverId || containsMember(members, host.serverId, agent.hostId, agent.id)), groupBy: agent => conversationState(agent) });
  const hostStatus = aggregateStates(states.map(bucket => bucket.key));
  async function createGroup() {
    if (!adding || pending.current || !path.trim() || !available) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      if (!await createFolder(host.serverId, path.trim())) { setError('Could not save. Please try again.'); return; }
      setAdding(false); setPath('');
    } catch { setError('Could not save. Check the server connection and try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Branch destination={{ hostId: host.serverId, groupId: null }} title={host.label} icon="server" state={!available ? host.status : hostStatus.state} hasUpdates={hostStatus.hasUpdates} view={view} menuActions={[{ id: 'new-folder', label: 'New folder…', disabled: !available || busy, onSelect: () => setAdding(true) }]}
    action={<><Pressable theme={view.theme} hoverBackground="transparent" focusRef={moreRef} accessibilityRole="button" accessibilityLabel={`More actions for ${host.label}`} accessibilityState={{ expanded: !!hostMenu }} onPress={() => moreRef.current?.measureInWindow((x,y,width,height) => setHostMenu({ x: x + width - 208, y: y + height + 4 }))} style={{ width: view.layout.compact ? 44 : 36, height: view.layout.compact ? 44 : 36, alignItems: 'center', justifyContent: 'center' }}><Glyph name="menu" color={c.foregroundMuted} /></Pressable><ContextMenu anchor={hostMenu} close={() => setHostMenu(null)} view={view} actions={[{ id: 'new-folder', label: 'New folder…', disabled: !available || busy, onSelect: () => { setAdding(true); setError(null); } }]} /></>}
    editor={<EntryReveal open={adding} height={view.layout.compact ? 52 : 40}><View style={{ marginLeft: 32, marginRight: 4, marginTop: 2, marginBottom: 6, gap: 4, minWidth: 0 }} {...{ onKeyDown: (event: { key: string; stopPropagation(): void }) => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); setAdding(false); setError(null); } } }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 0, borderRadius: 5, borderWidth: 1, borderColor: focused ? c.accent : c.border, backgroundColor: c.surface1 }}>
        <TextInput ref={nameInput} accessibilityLabel={`Folder name on ${host.label}`} accessibilityHint="Choose any folder name. Press Enter to create." value={path} onChangeText={value => { setPath(value); setError(null); }} placeholder="Folder name…" placeholderTextColor={c.foregroundMuted} maxLength={60} editable={adding && !busy} autoFocus={adding} autoCapitalize="none" autoCorrect={false} returnKeyType="go" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onKeyPress={event => { if (event.nativeEvent.key === 'Escape' && !busy) { setAdding(false); setError(null); } }} onSubmitEditing={() => { void createGroup(); }} style={{ flex: 1, minWidth: 0, height: view.layout.compact ? 42 : 30, paddingVertical: 0, paddingHorizontal: 8, color: c.foreground, fontSize: 12, ...(view.layout.platform === 'web' ? { outlineStyle: 'none' as const } : {}) } as import('react-native').TextStyle} />
        <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={busy ? 'Creating folder' : 'Create folder'} accessibilityState={{ busy, disabled: busy || !available || !path.trim() }} disabled={!adding || busy || !available || !path.trim()} onPress={() => { void createGroup(); }} style={{ width: view.layout.compact ? 44 : 32, height: view.layout.compact ? 42 : 30, alignItems: 'center', justifyContent: 'center', opacity: path.trim() || busy ? 1 : 0.4 }}>{busy ? <StatusMark loadingColor={options.loadingColor} state="connecting" theme={view.theme} /> : <Glyph name="arrowRight" color={path.trim() && available ? c.accent : c.foregroundMuted} />}</Pressable>
      </View>
    </View></EntryReveal>}>
    {adding && error && <Text accessibilityRole="alert" style={{ color: c.statusDanger, fontSize: 11, lineHeight: 16, marginLeft: 32 }}>{error}</Text>}
    {available ? mode === 'server-project' ? <Projects hosts={[host.serverId]} view={view} row={row} excluded={excluded} /> : <ServerChats hostId={host.serverId} row={row} view={view} excluded={excluded} /> : <Text style={{ color: c.foregroundMuted, padding: 8, fontSize: 11 }}>{host.status === 'connecting' ? 'Connecting…' : host.status === 'error' ? 'Connection error' : 'Offline'}</Text>}
    {groups.filter(group => !group.parentId).map(group => <RootFolder key={group.id} group={group} groups={groups} hostId={host.serverId} view={view} row={row} folderAction={folderAction} />)}
  </Branch>;
}
function FolderConversations({ group, hostId, row }: { group: Group; hostId: string; row(ref: AgentRef, groupId: string | null, folderHostId?: string): ReactNode }) {
  const { options } = useConversationView();
  const agents = useAgents({ hosts: [...new Set(group.agentIds.map(id => memberRef(hostId, id).hostId))], where: agent => containsMember(group.agentIds, hostId, agent.hostId, agent.id) && matchesConversation(agent, options), orderBy: conversationOrder(options, group.agentIds, hostId) });
  return <>{agents.map(agent => row(agent, group.id, hostId))}</>;
}
function RootFolder({ group, groups, hostId, view, row, folderAction }: { folderAction?: FolderAction; group: Group; groups: Group[]; hostId: string; view: PluginSidebarViewProps; row(ref: AgentRef, groupId: string | null, folderHostId?: string): ReactNode }) {
  const { options } = useConversationView();
  const members = [...group.agentIds, ...groups.filter(child => child.parentId === group.id).flatMap(child => child.agentIds)];
  const agentStates = useAgents({ hosts: [...new Set(members.map(id => memberRef(hostId, id).hostId))], where: agent => (!options.members || options.members.some(member => member.hostId === agent.hostId && member.agentId === agent.id)) && containsMember(members, hostId, agent.hostId, agent.id), groupBy: agent => conversationState(agent) });
  const folderStatus = aggregateStates(agentStates.map(bucket => bucket.key));
  return <FolderArrival fresh={options.freshFolderId === group.id}><Branch state={folderStatus.state} hasUpdates={folderStatus.hasUpdates} destination={{ hostId, groupId: group.id }} title={group.name} icon="folder" view={view} menuActions={folderAction ? [
    { id: 'rename', label: 'Rename…', onSelect: () => folderAction(hostId, group, 'rename') },
    ...(!group.parentId ? [{ id: 'child', label: 'New subfolder…', onSelect: () => folderAction(hostId, group, 'child') }] : []),
    { id: 'delete', label: 'Delete folder', danger: true, onSelect: () => folderAction(hostId, group, 'delete') },
  ] : []}>
    {group.agentIds.length ? <FolderConversations group={group} hostId={hostId} row={row} /> : <View style={{ minHeight: view.layout.compact ? 36 : 28, justifyContent: 'center' }}><Text style={{ color: view.theme.colors.foregroundMuted, paddingVertical: 2, paddingHorizontal: 8, fontSize: 10, lineHeight: 14 }}>Empty</Text></View>}
    {groups.filter(child => child.parentId === group.id).map(child => <RootFolder key={child.id} group={child} groups={[]} hostId={hostId} view={view} row={row} folderAction={folderAction} />)}
  </Branch></FolderArrival>;
}
export function AutomaticTree({ mode, hosts, view, row, createFolder, foldersForHost, folderAction, assignedConversations, conversationOptions = defaultConversationOptions, unfiledOrder = () => [] }: { assignedConversations?: Set<string>; conversationOptions?: ConversationOptions; unfiledOrder?(hostId: string): readonly string[]; folderAction?: FolderAction; createFolder(hostId: string, name: string): Promise<boolean>; foldersForHost(hostId: string): Group[]; mode: 'server' | 'project' | 'server-project'; hosts: readonly { serverId: string; label: string; status?: string }[]; view: PluginSidebarViewProps; row(ref: AgentRef, groupId: string | null, folderHostId?: string): ReactNode }) {
  if (!hosts.length) return <Text style={{ color: view.theme.colors.foregroundMuted, padding: 8 }}>No connected servers</Text>;
  const excluded = assignedConversations ?? new Set(hosts.flatMap(host => foldersForHost(host.serverId).flatMap(group => group.agentIds.map(id => { const ref = memberRef(host.serverId, id); return `${ref.hostId}:${ref.agentId}`; }))));
  const rootFolders = hosts.flatMap(host => foldersForHost(host.serverId).filter(group => !group.projectKey && (group.topLevel || mode === 'project') && !group.parentId).map(group => <RootFolder key={`${host.serverId}:${group.id}`} group={group} groups={foldersForHost(host.serverId)} hostId={host.serverId} view={view} row={row} folderAction={folderAction} />));
  return <ConversationViewContext.Provider value={{ options: conversationOptions, unfiledOrder, foldersForHost }}>{mode === 'project' ? <Projects hosts={hosts.map(h => h.serverId)} view={view} row={row} excluded={excluded} /> : hosts.map(host => {
    const groups = foldersForHost(host.serverId);
    const rootIds = new Set(groups.filter(group => group.topLevel).map(group => group.id));
    return <HostBranch key={host.serverId} host={host} mode={mode} view={view} row={row} createFolder={createFolder} folderAction={folderAction} excluded={excluded} groups={groups.filter(group => (mode === 'server' || !group.projectKey) && !group.topLevel && !(group.parentId && rootIds.has(group.parentId)))} />;
  })}{rootFolders}</ConversationViewContext.Provider>;
}
