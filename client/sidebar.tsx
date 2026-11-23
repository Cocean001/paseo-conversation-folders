import { currentPickerTree } from '../shared/folder-picker';
import { FolderAdd } from './folder-add';
import { ConversationViewContext } from './conversation-view';
import { FolderDragProvider, DragFolderRow, FolderDropTarget, type DragFolder, type FolderDestination } from './folder-drag';
import { SidebarTabsView, type SidebarTabScope, type SidebarTabControls } from './sidebar-tabs';
import { ConversationActions } from './conversation-actions';
import { touchMenu } from './web';
import { TouchDragProvider, TouchScrollView, useTouchDrag } from './touch-drag';
import { SteadyProvider, useSteadyList } from './steady';
import { conversationState, aggregateStates, quietSubtask } from '../shared/status';
import { ConversationDragProvider, DragConversationRow, ConversationDropTarget, type DragConversation, type ConversationDestination } from './drag-and-drop';
import { conversationOrder, matchesConversation, defaultConversationOptions, type ConversationOptions } from '../shared/conversations';
import { DropdownMenu, type DropdownAnchor, type DropdownItem } from './dropdown-menu';
import type { AgentRef, PluginSidebarViewProps } from '@getpaseo/plugin/client';
import { useAgent, useAgents, useHosts, useSettings, useRpc, useWorkspaces } from '@getpaseo/plugin/client';
import { FeedbackPressable as Pressable, Glyph, Reveal, Disclosure, Transition, StatusMark, EntryReveal, BranchIcon, FolderArrival, LoadingMark, loadingEffects, type LoadingEffect } from './visuals';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View, Platform } from 'react-native';
import { organization, hostOrganizations, displayPreferences, pinnedConversations } from '../shared/settings';
import { PinsContext, pinKey, type Pins } from './pins';
import { hostContext } from '../shared/host-context';
import { AutomaticTree, ProjectFolder } from './automatic-tree';
import { removeGroup, relocateGroup, memberId, memberRef, containsMember, applyAssignments, withProjectMembers } from '../shared/model';
import { t, useAppLanguage } from './i18n';
import { ViewStateProvider, useBranchOpen, useViewState } from './view-state';
import type { ReactNode } from 'react';

// CSS transitions remain local to plugin rows; reduced-motion disables them.
const mediaQuery = (globalThis as unknown as { matchMedia?: (query: string) => { matches: boolean } }).matchMedia;
const feedback = Platform?.OS === 'web' && mediaQuery && !mediaQuery('(prefers-reduced-motion: reduce)').matches ? { transitionProperty: 'background-color, opacity', transitionDuration: '140ms', transitionTimingFunction: 'ease-out' } : {};

type SubtaskChip = { count: number; open: boolean; alert: boolean; toggle(): void };
function ConversationRow({ reference, view, select, moving, detailed, serverLabel, loadingEffect, loadingColor, subtasks, nested, drag }: { drag?: DragConversation; subtasks?: SubtaskChip; nested?: boolean; loadingColor?: string; loadingEffect?: LoadingEffect; reference: AgentRef; view: PluginSidebarViewProps; select(id: string): void; moving: boolean; detailed?: boolean; serverLabel?: string }) {
  const agent = useAgent(reference, a => ({ title: a.title, status: a.status, requiresAttention: a.requiresAttention, attentionReason: a.attentionReason, lastActivityAt: a.lastActivityAt }));
  const touch = useTouchDrag();
  if (!agent) return null;
  const c = view.theme.colors;
  const selected = view.active.agent?.key === reference.key;
  return <ConversationActions reference={reference} view={view}>{openActions => <View style={{ ...feedback, flexDirection: 'row', alignItems: 'center', minWidth: 0, borderRadius: 6, paddingVertical: 0 }}>
    <Pressable theme={view.theme} hoverBackground="transparent" accessibilityState={{ selected }} accessibilityRole="button" accessibilityLabel={agent.title || t('Untitled conversation')} onPress={() => view.navigation.openAgent(reference)} onLongPress={moving ? () => select(reference.id) : touchMenu(view) ? () => { if (touch && drag) touch.lift({ kind: 'conversation', value: drag }, agent.title || t('Untitled conversation'), openActions); else openActions(); } : undefined} style={() => ({ flex: 1, minWidth: 0, minHeight: view.layout.compact ? 44 : 32, paddingLeft: 10, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent', borderRadius: 6 })}>
      {/* Inside a parent, a finished unread subtask is not news; running, permission and error still show. */}
      <StatusMark loadingColor={loadingColor} loadingEffect={loadingEffect} state={nested && conversationState(agent) === 'updated' ? 'finished' : conversationState(agent)} theme={view.theme} />
      <View style={{ flex: 1, minWidth: 0, paddingVertical: serverLabel || detailed ? 4 : 0 }}>
        <Text selectable={false} numberOfLines={detailed ? 2 : 1} style={{ color: nested ? c.foregroundMuted : c.foreground, fontSize: nested ? 13 : 14, lineHeight: nested ? 18 : 20, fontWeight: selected ? '600' : '400' }}>{agent.title || t('Untitled conversation')}</Text>
        {serverLabel && <Text selectable={false} numberOfLines={1} style={{ color: c.foregroundMuted, fontSize: 11, lineHeight: 15 }}>{serverLabel}</Text>}
      </View>

    </Pressable>
    {subtasks && <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={t('{0} subtasks', subtasks.count)} accessibilityState={{ expanded: subtasks.open }} onPress={subtasks.toggle} style={{ minHeight: view.layout.compact ? 40 : 24, paddingHorizontal: 6, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}><Glyph name="subtask" size={12} color={subtasks.alert ? c.statusWarning : c.foregroundMuted} /><Text selectable={false} style={{ color: subtasks.alert ? c.statusWarning : c.foregroundMuted, fontSize: 12 }}>{subtasks.count}</Text></Pressable>}
    {moving && <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={`Move ${agent.title ?? t('Untitled conversation')}`} onPress={() => select(reference.id)} style={{ padding: 8, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Glyph name="move" color={c.foregroundMuted} /></Pressable>}
  </View>}</ConversationActions>;
}

export function SidebarWithTabs(view: PluginSidebarViewProps) {
  useAppLanguage();
  return <ViewStateProvider><SteadyProvider><SidebarTabsView view={view}>{(scope, controls) => <FolderSidebar key={scope?.tab.id || 'all'} {...view} tabScope={scope} tabControls={controls} />}</SidebarTabsView></SteadyProvider></ViewStateProvider>;
}
export function FolderSidebar(view: PluginSidebarViewProps & {tabScope?: SidebarTabScope; tabControls?:SidebarTabControls}) {
  const { tabScope } = view;
  const originalSettings = useSettings(organization);
  const settings = tabScope ? { ...originalSettings, status: 'ready' as const, values: tabScope.tab.organization, revision: tabScope.revision, saving:tabScope.saving, saveError:tabScope.error, save:tabScope.saveOrganization } : originalSettings;
  const preferences = useSettings(displayPreferences);
  const [optionsAnchor, setOptionsAnchor] = useState<DropdownAnchor | null>(null);
  const showOptions = optionsAnchor !== null;
  const optionsButton = useRef<View>(null);
  const setShowOptions = (open: boolean | ((value: boolean) => boolean)) => {
    const next = typeof open === 'function' ? open(showOptions) : open;
    if (!next) setOptionsAnchor(null);
    else optionsButton.current?.measureInWindow((x, y, width, height) => setOptionsAnchor({ right: x + width, top: y + height + 4 }));
  };
  const options = preferences.status === 'ready' ? preferences.values : { loadingColor: '#4F86F7', loadingEffect: 'spinner' as const, showBackground: true, sortBy: 'activity' as const, sortDirection: 'desc' as const, filter: 'all' as const, grouping: 'manual' as const, showServer: false, showTabs: true, tabStyle: 'full' as const, showCounts: true, multilineTitles: false };
  const preferencePending = useRef(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const option = async (patch: Partial<typeof options>) => {
    if (preferences.status !== 'ready' || preferencePending.current) return false;
    preferencePending.current = true; setSavingPreferences(true); setPreferenceError(null);
    try {
      const saved = await preferences.save({ ...options, ...patch }, preferences.revision);
      if (!saved) setPreferenceError('Changes were not saved. Please try again.');
      return saved;
    } catch { setPreferenceError('Could not save settings. Check the host connection and try again.'); return false; }
    finally { preferencePending.current = false; setSavingPreferences(false); }
  };
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const originalExtraSettings = useSettings(hostOrganizations);
  const extraSettings = tabScope ? { ...originalExtraSettings, status:'ready' as const, values:{hosts:tabScope.tab.hosts}, revision:tabScope.revision, saving:tabScope.saving, saveError:tabScope.error, save:tabScope.saveHosts } : originalExtraSettings;
  const readHostContext = useRpc(hostContext);
  const [ownerHost, setOwnerHost] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [pickedHost, setPickedHost] = useState<string | null>(null);
  const pending = useRef(false);
  useEffect(() => { let active = true; void readHostContext({}).then(result => { if (active) setOwnerHost(result.hostId); }).catch(error => { if (active) setContextError(String(error)); }); return () => { active = false; }; }, [readHostContext]);
  const viewApi = useViewState();
  const pinSettings = useSettings(pinnedConversations);
  const pinnedItems = pinSettings.status === 'ready' ? pinSettings.values.items : [];
  const pinnedKeys = new Set(pinnedItems.map(item => pinKey(item.hostId, item.agentId)));
  const pins: Pins = {
    keys: pinnedKeys,
    isPinned: ref => pinnedKeys.has(pinKey(ref.hostId, ref.id)),
    toggle: async ref => {
      if (pinSettings.status !== 'ready') return false;
      const key = pinKey(ref.hostId, ref.id);
      const items = pinnedKeys.has(key) ? pinnedItems.filter(item => pinKey(item.hostId, item.agentId) !== key) : [{ hostId: ref.hostId, agentId: ref.id }, ...pinnedItems];
      return pinSettings.save({ items }, pinSettings.revision);
    },
  };
  // A short sidebar (a small window, or many header and footer items) gets denser rows so conversations stay in view.
  const [listHeight, setListHeight] = useState(0);
  const short = listHeight > 0 && listHeight < 560;
  const [freshFolderId, setFreshFolderId] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [folderSaving, setFolderSaving] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const folderRevision = useRef<{ hostId: string; revision: string } | null>(null);
  const [folderFocused, setFolderFocused] = useState(false);
  const folderInput = useRef<TextInput>(null);
  useEffect(() => { if (editing) folderInput.current?.focus(); else folderInput.current?.blur(); }, [editing]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [, setActivityTick] = useState(0);
  useEffect(() => { const timer = setInterval(() => setActivityTick(value => value + 1), 60000); return () => clearInterval(timer); }, []);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [labelFilter, setLabelFilter] = useState<string[]>([]);
  const projects = useWorkspaces({ groupBy: workspace => ({ key: workspace.project.key, title: workspace.projectDisplayName }) });
  const labels = useWorkspaces({ groupBy: workspace => workspace.labels });
  const background = useWorkspaces({ where: workspace => workspace.background });
  const blockedBackground = new Set(options.showBackground === false ? background.map(workspace => workspace.key) : []);
  const allowedProjects = new Set(projects.filter(project => projectFilter.includes(project.key)).flatMap(project => project.items.map(workspace => workspace.key)));
  const allowedLabels = new Set(labels.filter(label => labelFilter.includes(label.key)).flatMap(label => label.items.map(workspace => workspace.key)));
  const workspaceKeys = projectFilter.length || labelFilter.length || options.showBackground === false ? [...new Set(projects.flatMap(project => project.items.map(workspace => workspace.key)))].filter(key => !blockedBackground.has(key) && (!projectFilter.length || allowedProjects.has(key)) && (!labelFilter.length || allowedLabels.has(key))) : undefined;
  const allAgents = useAgents({ where: agent => !agent.background });
  // Subtasks nest under a parent that is itself listed; children of hidden parents stay top-level.
  const parents = new Set(allAgents.filter(agent => !tabScope || tabScope.tab.members.some(member => member.hostId === agent.hostId && member.agentId === agent.id)).map(agent => agent.key));
  const subtaskGroups = useSteadyList(useAgents({ where: agent => !agent.background && !!agent.parentAgent, groupBy: agent => agent.parentAgent!.key, orderBy: ['lastActivityAt', 'desc'] }));
  const alertedParents = new Set(useAgents({ where: agent => !agent.background && !!agent.parentAgent && ['permission', 'error'].includes(conversationState(agent)), groupBy: agent => agent.parentAgent!.key }).map(group => group.key));
  const conversationOptions: ConversationOptions = { parents, pinned: pinnedKeys, ...(tabScope ? {members:tabScope.tab.members} : {}), ...defaultConversationOptions, ...options, search, workspaceKeys, freshFolderId };
  // Long first-prompt titles read better on two lines where there is room; each device can choose.
  const titleLines = viewApi?.titleLines ?? (options.multilineTitles ? 2 : view.layout.compact || short ? 1 : 2);
  const detailed = titleLines === 2;
  const setTitleLines = (lines: number) => { if (viewApi) viewApi.setTitleLines(lines); else void option({ multilineTitles: lines === 2 }); };
  const nesting = !search.trim() && conversationOptions.filter === 'all';
  const subtasksOf = (key: string) => nesting ? subtaskGroups.find(group => group.key === key)?.items : undefined;
  const c = view.theme.colors;
  const hosts = useHosts().map(host => ({ ...host, label: /macbook/i.test(host.label) ? 'MacBook' : host.label }));
  const targetHost = pickedHost && hosts.some(h => h.serverId === pickedHost) ? pickedHost : ownerHost;
  const onlyHost = targetHost;
  // Manual folders keep the original default: only Unfiled starts open. The state is remembered per device.
  const folderKey = (id: string) => `folder:${targetHost}:${id}`;
  const isExpanded = (id: string) => viewApi ? viewApi.isOpen(folderKey(id), id === 'ungrouped') : id === 'ungrouped';
  const expand = (id: string) => viewApi?.setOpen(folderKey(id), true);
  const agents = useSteadyList(useAgents({ hosts: onlyHost ? [onlyHost] : [], where: agent => matchesConversation(agent, conversationOptions), orderBy: conversationOrder(conversationOptions) }));
  const nativeAgents = useAgents({ groupBy: agent => agent.workspace.key });
  const stateGroups = useAgents({ where: agent => (!tabScope || tabScope.tab.members.some(member => member.hostId === agent.hostId && member.agentId === agent.id)) && !quietSubtask(agent), groupBy: agent => conversationState(agent) });
  const filteredAgents = useSteadyList(useAgents({ where: agent => matchesConversation(agent, conversationOptions), orderBy: conversationOrder(conversationOptions) }));
  const visible = agents;
  const button = (label: string, press: () => void) => <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={label} onPress={press} style={({ pressed }) => ({ minHeight: view.layout.compact ? 44 : 36, minWidth: (label === '＋' || label === '⋮') ? (view.layout.compact ? 44 : 36) : undefined, paddingHorizontal: 8, paddingVertical: 6, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, backgroundColor: pressed ? c.surface2 : c.surface1, flexShrink: 0 })}>{(label === 'New folder' || label === '＋') ? <Glyph name="plus" color={c.foregroundMuted} /> : label === '⋮' ? <Glyph name="menu" color={c.foregroundMuted} /> : label === 'View options' ? <Glyph name="settings" color={c.foregroundMuted} /> : null}{label !== '＋' && label !== '⋮' && <Text style={{ color: c.foregroundMuted, fontSize: 12, lineHeight: 16 }}>{t(label)}</Text>}</Pressable>;
  if (!ownerHost) return <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>{!contextError && <ActivityIndicator size="small" color={c.foregroundMuted} />}<Text style={{ color: contextError ? c.statusDanger : c.foregroundMuted }}>{contextError || t('Loading…')}</Text></View>;
  if (targetHost !== ownerHost && extraSettings.status !== 'ready') return <Text style={{ color: c.foregroundMuted, padding: 12 }}>{extraSettings.status === 'loading' ? t('Loading folders…') : extraSettings.error}</Text>;
  if (settings.status !== 'ready') return <View style={{ padding: 12 }}><Text style={{ color: c.foregroundMuted }}>{settings.status === 'loading' ? t('Loading folders…') : settings.error}</Text></View>;
  const rawHostState = (hostId: string) => hostId === ownerHost ? settings.values : extraSettings.status === 'ready' ? extraSettings.values.hosts[hostId] ?? { mode: 'folders' as const, groups: [], ungroupedOrder: [] } : null;
  const assignments = (settings.values.assignments ?? []).filter(assignment => assignment.groupId === null || rawHostState(assignment.folderHostId)?.groups.some(group => group.id === assignment.groupId));
  const hostState = (hostId: string) => { const raw = rawHostState(hostId); return raw ? applyAssignments(raw, hostId, assignments) : null; };
  const presentationHostState = (hostId: string) => { const raw = hostState(hostId); return raw ? withProjectMembers(raw, hostId, projects.map(project => ({ key: project.key, workspaceKeys: project.items.map(workspace => workspace.key) })), nativeAgents.flatMap(bucket => bucket.items.map(ref => ({ ...ref, workspace: { key: bucket.key } }))), assignments) : null; };
  const state = hostState(targetHost!) ?? settings.values;
  const displayedState = presentationHostState(targetHost!) ?? state;
  const pickerTree = currentPickerTree({ mode: options.grouping, hosts: pickedHost ? hosts.filter(host => host.serverId === pickedHost) : hosts, targetHost: targetHost!, groupsForHost: hostId => presentationHostState(hostId)?.groups ?? [], projects: projects.filter(project => (!workspaceKeys || project.items.some(workspace => workspaceKeys.includes(workspace.key))) && (!conversationOptions.members || nativeAgents.some(bucket => project.items.some(workspace => workspace.key === bucket.key) && bucket.items.some(agent => conversationOptions.members!.some(member => member.hostId === agent.hostId && member.agentId === agent.id))))).flatMap(project => project.items[0] ? [{ key: project.key, title: project.title || 'Project', hostId: project.items[0].hostId, workspaceKeys: project.items.map(workspace => workspace.key) }] : []), agents: nativeAgents.flatMap(bucket => bucket.items.filter(ref => filteredAgents.some(agent => agent.key === ref.key)).map(ref => ({hostId:ref.hostId,id:ref.id,workspace:{key:bucket.key}}))) });
  async function save(next: typeof state): Promise<boolean> {
    if (pending.current) return false;
    pending.current = true;
    try {
      if (targetHost === ownerHost && settings.status === 'ready') return await settings.save({ ...next, assignments: (settings.values.assignments ?? []).filter(item => item.folderHostId !== ownerHost || item.groupId === null || next.groups.some(group => group.id === item.groupId)) }, settings.revision);
      if (targetHost && extraSettings.status === 'ready') return await extraSettings.save({ hosts: { ...extraSettings.values.hosts, [targetHost]: next } }, extraSettings.revision);
      return false;
    } finally { pending.current = false; }
  }
  async function dropFolder(source: DragFolder, destination: FolderDestination): Promise<boolean> {
    if (pending.current || settings.status !== 'ready' || source.hostId !== destination.hostId) return false;
    const current = rawHostState(source.hostId);
    if (!current) return false;
    const unplaced = (list: Array<import('../shared/model').Group | undefined>) => list.filter((group, index): group is import('../shared/model').Group => !!group && !current.groups.some(existing => existing.id === group.id || existing.projectKey === group.projectKey) && list.findIndex(other => other?.projectKey === group.projectKey) === index);
    // In the project view every unplaced project joins the saved order at its on-screen position, so one drag never reshuffles the rest.
    const shown = options.grouping === 'project' && (source.project || destination.project) ? unplaced(projects.filter(project => project.items[0]?.hostId === source.hostId).map(project => ({ id: `project:${project.key}`, projectKey: project.key, name: (project.title || 'Project').slice(0, 60), agentIds: [] }))) : [];
    const additions = unplaced([source.project, destination.project]).filter(group => !shown.some(item => item.projectKey === group.projectKey));
    const prepared = { ...current, groups: [...shown, ...current.groups, ...additions] };
    const next = relocateGroup(prepared, source.groupId, destination);
    if (next === prepared) { setFolderError('Folders support two levels. Move a folder without children into a top-level folder.'); return false; }
    pending.current = true; setFolderError(null);
    try {
      const ok = source.hostId === ownerHost ? await settings.save(next, settings.revision) : extraSettings.status === 'ready' ? await extraSettings.save({ hosts: { ...extraSettings.values.hosts, [source.hostId]: next } }, extraSettings.revision) : false;
      if (!ok) setFolderError('Could not move folder. Refresh and try again.');
      if (ok && destination.parentId) expand(destination.parentId!);
      return ok;
    } catch { setFolderError('Could not move folder. Check the server connection and try again.'); return false; }
    finally { pending.current = false; }
  }
  // In the project view a newly placed project keeps its on-screen position: every unplaced project is saved in screen order with it.
  const withPlacedProject = (hostId: string, groups: readonly import('../shared/model').Group[], placed: import('../shared/model').Group) => options.grouping !== 'project' ? [...groups, placed] : [
    ...projects.filter(project => project.items[0]?.hostId === hostId && !groups.some(group => group.projectKey === project.key)).map(project => project.key === placed.projectKey ? placed : { id: `project:${project.key}`, projectKey: project.key, name: (project.title || 'Project').slice(0, 60), agentIds: [] }),
    ...groups, ...(projects.some(project => project.key === placed.projectKey && project.items[0]?.hostId === hostId) ? [] : [placed]),
  ];
  async function dropConversation(source: DragConversation, destination: ConversationDestination): Promise<boolean> {
    if (pending.current || settings.status !== 'ready') return false;
    const current = hostState(destination.hostId);
    const projectGroupId = destination.projectKey ? current?.groups.find(group => group.projectKey === destination.projectKey)?.id ?? `project-${Date.now().toString(36)}` : undefined;
    const groupId = projectGroupId ?? destination.groupId;
    if (!current || (!destination.projectKey && groupId !== null && !current.groups.some(group => group.id === groupId))) { setFolderError('This folder is no longer available.'); return false; }
    if (groupId === null && source.hostId !== destination.hostId) { setFolderError('Unfiled belongs to the conversation’s original host.'); return false; }
    if (destination.beforeId === source.agentId && (destination.beforeHostId ?? destination.hostId) === source.hostId) return true;
    pending.current = true; setFolderError(null);
    try {
      const nextAssignments = [...assignments.filter(item => item.hostId !== source.hostId || item.agentId !== source.agentId), { ...source, folderHostId: destination.hostId, groupId, ...(destination.beforeId ? { beforeId: destination.beforeId, beforeHostId: destination.beforeHostId ?? destination.hostId } : {}) }];
      const newProjectGroup = destination.projectKey && !current.groups.some(group => group.id === groupId) ? { id: groupId!, projectKey: destination.projectKey, name: (destination.projectTitle || 'Project').slice(0, 60), agentIds: [] } : null;
      if (newProjectGroup && destination.hostId !== ownerHost && !tabScope) {
        if (extraSettings.status !== 'ready' || !await extraSettings.save({ hosts: { ...extraSettings.values.hosts, [destination.hostId]: { ...current, groups: withPlacedProject(destination.hostId, current.groups, newProjectGroup) } } }, extraSettings.revision)) { setFolderError('Could not prepare project folder. Try again.'); return false; }
      }
      const nextOwner = { ...settings.values, ...(newProjectGroup && destination.hostId === ownerHost ? { groups: withPlacedProject(destination.hostId, settings.values.groups, newProjectGroup) } : {}), assignments: nextAssignments };
      const saved = tabScope
        ? await tabScope.saveOrganization(nextOwner, settings.revision, newProjectGroup && destination.hostId !== ownerHost ? { ...tabScope.tab.hosts, [destination.hostId]: { ...current, groups: withPlacedProject(destination.hostId, current.groups, newProjectGroup) } } : undefined)
        : await settings.save(nextOwner, settings.revision);
      if (!saved) { setFolderError('Could not move conversation. Refresh settings and try again.'); return false; }
      if (destination.beforeId && options.sortBy !== 'manual' && !await option({ sortBy: 'manual' })) setFolderError('Conversation moved, but custom order could not be enabled. Choose Sort by → Custom order and retry.');
      expand(destination.groupId ?? 'ungrouped');
      return true;
    } catch { setFolderError('Could not move conversation. Check the host connection.'); return false; }
    finally { pending.current = false; }
  }
  async function addConversations(sources: readonly AgentRef[], destination: ConversationDestination, revision?: string): Promise<boolean> {
    if (pending.current || settings.status !== 'ready' || revision !== settings.revision) return false;
    const current = rawHostState(destination.hostId);
    if (!current || !current.groups.some(group => group.id === destination.groupId)) return false;
    pending.current = true;
    try {
      const keys = new Set(sources.map(source => JSON.stringify([source.hostId, source.id])));
      const nextAssignments = [...assignments.filter(assignment => !keys.has(JSON.stringify([assignment.hostId, assignment.agentId]))), ...sources.map(source => ({hostId:source.hostId,agentId:source.id,folderHostId:destination.hostId,groupId:destination.groupId}))];
      const saved = await settings.save({...settings.values, assignments:nextAssignments}, settings.revision);
      if (saved) expand(destination.groupId!);
      return saved;
    } finally { pending.current = false; }
  }
  function conversationRow(reference: AgentRef, groupId: string | null, folderHostId = reference.hostId, project?: {key:string;title:string}) {
    const kids = subtasksOf(reference.key);
    if (kids?.length) return <SubtaskGroup key={reference.key} parentKey={reference.key} kids={kids} alert={alertedParents.has(reference.key)} row={chip => parentRow(reference, groupId, folderHostId, project, chip)} child={child => <ConversationRow key={child.key} nested loadingColor={options.loadingColor} loadingEffect={options.loadingEffect} reference={child} view={view} moving={false} select={() => {}} />} />;
    return parentRow(reference, groupId, folderHostId, project);
  }
  function parentRow(reference: AgentRef, groupId: string | null, folderHostId: string, project?: {key:string;title:string}, subtasks?: SubtaskChip) {
    return <ConversationDropTarget key={reference.key} destination={{ hostId: folderHostId, groupId, beforeId: reference.id, beforeHostId: reference.hostId, ...(project ? {projectKey:project.key,projectTitle:project.title} : {}) }} view={view}>
      <DragConversationRow source={{ hostId: reference.hostId, agentId: reference.id }}><ConversationRow drag={{ hostId: reference.hostId, agentId: reference.id }} loadingColor={options.loadingColor} loadingEffect={options.loadingEffect} reference={reference} view={view} moving={options.grouping === 'manual' && selected !== null} select={id => setSelected(memberId(targetHost!, reference.hostId, id))} detailed={detailed} subtasks={subtasks} serverLabel={hosts.length > 1 && (groupId !== null || options.showServer) ? hosts.find(host => host.serverId === reference.hostId)?.label || 'Disconnected server' : undefined} /></DragConversationRow>
    </ConversationDropTarget>;
  }
  async function createHostFolder(hostId: string, name: string) {
    const current = hostState(hostId);
    if (!current || pending.current) return false;
    pending.current = true;
    try {
      const id = `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
      setFreshFolderId(id);
      const next = { ...current, groups: [...current.groups, { id, name, agentIds: [] }] };
      const saved = hostId === ownerHost && settings.status === 'ready' ? await settings.save(next, settings.revision) : extraSettings.status === 'ready' ? await extraSettings.save({ hosts: { ...extraSettings.values.hosts, [hostId]: next } }, extraSettings.revision) : false;
      if (!saved) setFreshFolderId(undefined);
      return saved;
    } finally { pending.current = false; }
  }
  async function folderAction(hostId: string, group: import('../shared/model').Group, action: 'rename' | 'child' | 'delete') {
    setPickedHost(hostId); setFolderError(null);
    if (action === 'delete') {
      const current = hostState(hostId); if (!current || pending.current) return;
      pending.current = true;
      try {
        const removed = removeGroup(current, group.id);
        const next = { ...removed, ...(hostId === ownerHost ? { assignments: assignments.filter(item => item.folderHostId !== hostId || item.groupId !== group.id) } : {}) };
        const ok = hostId === ownerHost && settings.status === 'ready' ? await settings.save(next, settings.revision) : extraSettings.status === 'ready' ? await extraSettings.save({ hosts: { ...extraSettings.values.hosts, [hostId]: next } }, extraSettings.revision) : false;
        if (!ok) setFolderError('Could not delete folder. Please try again.');
      } catch { setFolderError('Could not delete folder. Check the connection.'); }
      finally { pending.current = false; }
      return;
    }
    setParentId(action === 'child' ? group.id : undefined);
    setRenaming(action === 'rename' ? group.id : null);
    folderRevision.current = { hostId, revision: (hostId === ownerHost && settings.status === 'ready' ? settings.revision : extraSettings.status === 'ready' ? extraSettings.revision : '') };
    setDraft(action === 'rename' ? group.name : ''); setEditing(true);
  }
  const assigned = new Set(hosts.flatMap(host => (presentationHostState(host.serverId)?.groups ?? []).flatMap(group => group.agentIds.map(id => { const ref = memberRef(host.serverId, id); return `${ref.hostId}:${ref.agentId}`; }))));
  function toggle(id: string) { viewApi?.setOpen(folderKey(id), !isExpanded(id)); }
  function rememberFolderRevision() { folderRevision.current = { hostId: targetHost!, revision: targetHost === ownerHost && settings.status === 'ready' ? settings.revision : extraSettings.status === 'ready' ? extraSettings.revision : '' }; }
  function closeFolderEditor() { if (!folderSaving) { folderRevision.current = null; setEditing(false); setRenaming(null); setFolderError(null); } }
  async function create() {
    const name = draft.trim(); if (!editing || !name || pending.current || folderSaving || settings.status !== 'ready') return;
    const revision = targetHost === ownerHost ? settings.revision : extraSettings.status === 'ready' ? extraSettings.revision : '';
    if (!folderRevision.current || folderRevision.current.hostId !== targetHost || folderRevision.current.revision !== revision) { setFolderError('Folders changed on another client. Cancel and reopen this editor before saving.'); return; }
    setFolderSaving(true); setFolderError(null);
    try {
      const id = `group-${Date.now().toString(36)}`;
      const groups = renaming ? state.groups.map(g => g.id === renaming ? { ...g, name } : g) : [...state.groups, { id, name, agentIds: [], ...(parentId ? { parentId } : options.grouping !== 'manual' ? { topLevel: true } : {}) }];
      if (!renaming) setFreshFolderId(id);
      if (await save({ ...state, groups })) { setDraft(''); setEditing(false); setRenaming(null); }
      else setFolderError('Could not save. Please try again.');
    } catch { setFolderError('Could not save. Check the server connection and try again.'); }
    finally { setFolderSaving(false); }
  }
  // Hiding background helpers is the intended default here, so it does not count as an active filter.
  const filtersActive = conversationOptions.filter !== 'all' || projectFilter.length > 0 || labelFilter.length > 0 || pickedHost !== null;
  const multiHost = hosts.length > 1;
  const groupingNames = { manual: t('Custom folders'), server: t('Server'), project: t('Project'), 'server-project': t('Server / Project') };
  const sortNames = { activity: t('Last activity'), created: t('Creation time'), title: t('Title'), manual: t('Custom order') };
  const viewMenu: DropdownItem[] = [
    ...(filtersActive ? [{ id: 'clear', icon: 'close' as const, label: t('Clear filters'), onSelect: () => { setProjectFilter([]); setLabelFilter([]); setPickedHost(null); void option({ filter: 'all' }); setShowOptions(false); } }] : []),
    { id: 'grouping', icon: 'folder', label: t('Group by'), value: groupingNames[options.grouping], items: (Object.keys(groupingNames) as Array<keyof typeof groupingNames>).map(grouping => ({ id: grouping, icon: ({ manual: 'folder', server: 'server', project: 'project', 'server-project': 'globe' } as const)[grouping], label: groupingNames[grouping], checked: options.grouping === grouping, onSelect: () => { void option({ grouping }); setSelected(null); } })) },
    { id: 'sort', icon: 'sort', label: t('Sort by'), value: sortNames[conversationOptions.sortBy], items: [
      ...(['activity','created','title','manual'] as const).map(sortBy => ({ id: sortBy, icon: ({ activity: 'clock', created: 'plus', title: 'title', manual: 'move' } as const)[sortBy], label: sortNames[sortBy], checked: conversationOptions.sortBy === sortBy, onSelect: () => { void option({ sortBy }); } })),
      { id: 'asc', label: t('Ascending'), separatorBefore: true, checked: conversationOptions.sortDirection === 'asc', disabled: conversationOptions.sortBy === 'manual', onSelect: () => { void option({ sortDirection: 'asc' }); } },
      { id: 'desc', label: t('Descending'), checked: conversationOptions.sortDirection === 'desc', disabled: conversationOptions.sortBy === 'manual', onSelect: () => { void option({ sortDirection: 'desc' }); } },
    ] },
    { id: 'filter', icon: 'filter', label: t('Status'), value: ({ all: t('All'), running: t('Running'), attention: t('Needs attention'), errors: t('Errors') })[conversationOptions.filter], items: (['all','running','attention','errors'] as const).map(filter => ({ id: filter, icon: ({ all: 'project', running: 'clock', attention: 'alert', errors: 'alert' } as const)[filter], label: ({ all: t('All conversations'), running: t('Running'), attention: t('Needs attention'), errors: t('Errors') })[filter], checked: conversationOptions.filter === filter, onSelect: () => { void option({ filter }); } })) },
    { id: 'titles', icon: 'title', label: t('Titles'), value: detailed ? t('Two lines') : t('Single line'), items: [{ id: 'single', label: t('Single line'), checked: !detailed, onSelect: () => setTitleLines(1) }, { id: 'multiline', label: t('Two lines'), checked: detailed, onSelect: () => setTitleLines(2) }] },
    { id: 'display', icon: 'settings', label: t('Display'), items: [
      ...(multiHost ? [{ id: 'labels', label: t('Server labels'), checked: options.showServer, onSelect: () => { void option({ showServer: !options.showServer }); } },
      { id: 'tabs', label: t('Server tabs'), checked: options.showTabs, onSelect: () => { void option({ showTabs: !options.showTabs }); setPickedHost(null); } }] : []),
      { id: 'counts', label: t('Conversation counts'), checked: options.showCounts, onSelect: () => { void option({ showCounts: !options.showCounts }); } },
      { id: 'loading-color', label: t('Loading color'), height: view.layout.compact ? 74 : 62, separatorBefore: true, content: <View style={{ gap: 6, paddingVertical: 6 }}>
        <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>{t('Loading color')}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>{[{ name: 'Blue', value: '#4F86F7' }, { name: 'Purple', value: '#A78BFA' }, { name: 'Cyan', value: '#22B8CF' }, { name: 'Orange', value: '#F59E42' }, { name: 'Pink', value: '#EC70AC' }].map(color => <Pressable key={color.value} theme={view.theme} accessibilityRole="button" accessibilityLabel={`Loading color: ${color.name}`} accessibilityState={{ selected: (options.loadingColor || '#4F86F7') === color.value, disabled: savingPreferences }} disabled={savingPreferences || preferences.status !== 'ready'} onPress={() => { void option({ loadingColor: color.value }); }} style={{ width: view.layout.compact ? 44 : 32, height: view.layout.compact ? 44 : 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: (options.loadingColor || '#4F86F7') === color.value ? c.foregroundMuted : 'transparent' }}><View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color.value }} /></Pressable>)}</View>
      </View> },
      ...loadingEffects.map((effect, index) => ({ id: `loading-${effect.id}`, label: t('Loading · {0}', t(effect.label)), separatorBefore: index === 0, preview: <LoadingMark effect={effect.id} color={options.loadingColor} />, checked: (options.loadingEffect || 'spinner') === effect.id, keepOpen: true, onSelect: () => { void option({ loadingEffect: effect.id }); } })),
    ] },
    ...(multiHost ? [{ id: 'hosts', icon: 'server' as const, label: t('Host'), separatorBefore: true, value: hosts.find(host => host.serverId === (options.grouping === 'manual' ? targetHost : pickedHost))?.label || t('All hosts'), items: [...(options.grouping !== 'manual' ? [{ id: 'all', label: t('All hosts'), checked: pickedHost === null, onSelect: () => setPickedHost(null) }] : []), ...hosts.map(host => ({ id: host.serverId, label: host.label, checked: pickedHost === host.serverId, onSelect: () => setPickedHost(host.serverId) }))] }] : []),
    { id: 'projects', icon: 'project', label: t('Project'), separatorBefore: !multiHost, value: projectFilter.length ? t('{0} selected', projectFilter.length) : undefined, items: [
      { id: 'all-projects', label: t('All projects'), checked: !projectFilter.length, onSelect: () => setProjectFilter([]) },
      ...projects.map(project => ({ id: project.key, icon: 'project' as const, label: project.title || t('Project'), checked: projectFilter.includes(project.key), keepOpen: true, onSelect: () => setProjectFilter(previous => previous.includes(project.key) ? previous.filter(key => key !== project.key) : [...previous, project.key]) })),
    ] },
    { id: 'labels', icon: 'tag', label: t('Labels'), value: labelFilter.length ? t('{0} selected', labelFilter.length) : undefined, items: [
      { id: 'all-labels', label: t('All labels'), checked: !labelFilter.length, onSelect: () => setLabelFilter([]) },
      ...labels.map(label => ({ id: label.key, icon: 'tag' as const, label: label.title || label.key, checked: labelFilter.includes(label.key), keepOpen: true, onSelect: () => setLabelFilter(previous => previous.includes(label.key) ? previous.filter(key => key !== label.key) : [...previous, label.key]) })),
    ] },
    { id: 'background', label: t('Show background workspaces'), separatorBefore: true, checked: options.showBackground !== false, onSelect: () => { void option({ showBackground: options.showBackground === false }); } },
    ...(view.tabControls ? [{id:'custom-tabs',icon:'tabs' as const,label:t('Custom tabs'),value:view.tabControls.enabled?t('On'):t('Off'),items:view.tabControls.items}] : []),
    ...(multiHost ? [{ id: 'tabs', icon: 'tabs' as const, label: t('Server tabs'), value: options.showTabs ? ({ full: t('Name'), compact: t('Initial'), number: t('Count') })[options.tabStyle] : t('Hidden'), items: [
      { id: 'tabs-visible', label: t('Show server tabs'), checked: options.showTabs, onSelect: () => { void option({ showTabs: !options.showTabs }); } },
      ...(['full','compact','number'] as const).map(tabStyle => ({ id: tabStyle, label: ({ full: t('Name'), compact: t('Initial'), number: t('Count') })[tabStyle], checked: options.showTabs && options.tabStyle === tabStyle, onSelect: () => { void option({ tabStyle, showTabs: true }); } })),
    ] }] : []),
    ...(options.grouping === 'manual' ? [{ id: 'organize', label: t('Organize conversations…'), separatorBefore: true, onSelect: () => { setSelected(''); setShowOptions(false); } }] : []),
  ];
  const compact = view.layout.compact;
  const iconButton = { width: compact ? 40 : 28, height: compact ? 40 : 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' } as const;
  return <PinsContext.Provider value={pins}><FolderDragProvider groups={hostId => rawHostState(hostId)?.groups ?? []} move={dropFolder}><ConversationDragProvider move={dropConversation}><TouchDragProvider enabled={touchMenu(view)} view={view}><TouchScrollView onLayout={event => setListHeight(event.nativeEvent.layout.height)} style={{ flex: 1, minWidth: 0, width: '100%' }} contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 6, paddingBottom: 12, gap: 1, minWidth: 0 }} keyboardShouldPersistTaps="handled">
    <FolderDropTarget hostId={targetHost!} root anyHost view={view}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 0, marginBottom: 6 }}>
      <View style={{ flex: 1, minWidth: 0, height: compact ? 40 : 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 9, borderRadius: 7, borderWidth: 1, borderColor: searchFocused ? c.accent : c.border, backgroundColor: c.surface0 }}>
        <Glyph name="search" size={13} color={c.foregroundMuted} />
        <TextInput accessibilityLabel={t('Search conversations…')} value={search} onChangeText={setSearch} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onKeyPress={event => { if (event.nativeEvent.key === 'Escape') setSearch(''); }} placeholder={tabScope ? `${tabScope.tab.name} · ${t('Search conversations…')}` : t('Search conversations…')} placeholderTextColor={c.foregroundMuted} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={{ flex: 1, minWidth: 0, height: '100%', paddingVertical: 0, color: c.foreground, fontSize: compact ? 15 : 13, ...(view.layout.platform === 'web' ? { outlineStyle: 'none' as const } : {}) } as import('react-native').TextStyle} />
        {!!search && <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={t('Clear filters')} onPress={() => setSearch('')} style={iconButton}><Glyph name="close" color={c.foregroundMuted} size={12} /></Pressable>}
      </View>
      <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={editing ? t('Cancel') : t('New folder')} accessibilityState={{ expanded: editing, disabled: folderSaving }} disabled={folderSaving} onPress={() => { if (editing) closeFolderEditor(); else { rememberFolderRevision(); setParentId(undefined); setRenaming(null); setDraft(''); setFolderError(null); setEditing(true); } }} style={iconButton}><Glyph name={editing ? 'close' : 'folderPlus'} size={15} color={c.foregroundMuted} /></Pressable>
      <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={viewApi?.collapsed ? t('Restore expansion') : t('Collapse all')} onPress={() => { viewApi?.toggleCollapseAll(options.grouping === 'manual' ? [...state.groups.map(group => group.id), 'ungrouped'].map(folderKey) : []); setMenu(null); setPicker(null); }} style={iconButton}><Glyph name={viewApi?.collapsed ? 'expand' : 'collapse'} size={15} color={c.foregroundMuted} /></Pressable>
      <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={t('View options')} focusRef={optionsButton} accessibilityState={{ expanded: showOptions }} onPress={() => setShowOptions(v => !v)} style={iconButton}><Glyph name="filter" size={15} color={filtersActive ? c.accent : c.foregroundMuted} /></Pressable>
    </View></FolderDropTarget>
    {selected !== null && button('Done', () => setSelected(null))}
    <DropdownMenu anchor={optionsAnchor} close={() => setShowOptions(false)} view={view} busy={savingPreferences || view.tabControls?.saving || preferences.status !== 'ready'} error={preferenceError} items={viewMenu} />
    {options.showTabs !== false && multiHost && <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Server tabs" contentContainerStyle={{ flexDirection: 'row', gap: 2, paddingHorizontal: 4 }} style={{ flexGrow: 0, minWidth: 0 }}>
      {hosts.length > 1 && options.grouping !== 'manual' && <Pressable theme={view.theme} accessibilityRole="tab" accessibilityLabel="All hosts" accessibilityState={{ selected: pickedHost === null }} onPress={() => setPickedHost(null)} style={{ minHeight: view.layout.compact ? 44 : 32, paddingHorizontal: 8, justifyContent: 'center', backgroundColor: pickedHost === null ? c.surface1 : 'transparent' }}><Text style={{ color: c.foregroundMuted, fontSize: 11 }}>All</Text></Pressable>}
      {hosts.map(host => <Pressable theme={view.theme} key={host.serverId} accessibilityRole="tab" accessibilityLabel={`Select host ${host.label}`} accessibilityState={{ selected: hosts.length === 1 || (options.grouping === 'manual' ? targetHost === host.serverId : pickedHost === host.serverId) }} accessibilityHint={`${allAgents.filter(a => a.hostId === host.serverId && (!tabScope || tabScope.tab.members.some(member => member.hostId === a.hostId && member.agentId === a.id))).length} conversations`} onPress={() => { setPickedHost(host.serverId); setSelected(null); setEditing(false); setDraft(''); setPicker(null); setMenu(null); setRenaming(null); }} style={{ maxWidth: 220, minHeight: view.layout.compact ? 44 : 32, minWidth: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderRadius: 5, backgroundColor: hosts.length === 1 || (options.grouping === 'manual' ? targetHost === host.serverId : pickedHost === host.serverId) ? c.surface2 : 'transparent' }}><Text numberOfLines={1} style={{ color: c.foregroundMuted, fontSize: 11, flexShrink: 1 }}>{options.tabStyle === 'number' ? allAgents.filter(a => a.hostId === host.serverId && (!tabScope || tabScope.tab.members.some(member => member.hostId === a.hostId && member.agentId === a.id))).length : options.tabStyle === 'compact' ? host.label.slice(0, 1).toUpperCase() : host.label}{options.tabStyle !== 'number' && options.showCounts ? ` · ${allAgents.filter(a => a.hostId === host.serverId && (!tabScope || tabScope.tab.members.some(member => member.hostId === a.hostId && member.agentId === a.id))).length}` : ''}{host.status === 'offline' || host.status === 'error' ? ' (offline)' : ''}</Text></Pressable>)}
    </ScrollView>}
    <EntryReveal open={editing} height={view.layout.compact ? 52 : 40}>
      <View style={{ marginHorizontal: 8, marginTop: 2, marginBottom: 6, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 0, borderRadius: 5, borderWidth: 1, borderColor: folderFocused ? c.accent : c.border, backgroundColor: c.surface1 }}>
          <TextInput ref={folderInput} accessibilityLabel="Folder name" accessibilityHint="Enter a name and press Enter to save. Escape cancels." value={draft} onChangeText={value => { setDraft(value); setFolderError(null); }} placeholder={parentId && !renaming ? t('Subfolder name…') : t('Folder name…')} placeholderTextColor={c.foregroundMuted} maxLength={60} editable={editing && !folderSaving} autoCapitalize="none" autoCorrect={false} returnKeyType="done" onFocus={() => setFolderFocused(true)} onBlur={() => setFolderFocused(false)} onKeyPress={event => { if (event.nativeEvent.key === 'Escape') closeFolderEditor(); }} onSubmitEditing={() => { void create(); }} style={{ flex: 1, minWidth: 0, height: view.layout.compact ? 42 : 30, paddingVertical: 0, paddingHorizontal: 8, color: c.foreground, fontSize: 12, ...(view.layout.platform === 'web' ? { outlineStyle: 'none' as const } : {}) } as import('react-native').TextStyle} />
          <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={folderSaving ? 'Saving folder' : renaming ? 'Save' : 'Create'} accessibilityHint={renaming ? 'Save folder name' : 'Create folder'} accessibilityState={{ busy: folderSaving, disabled: !editing || folderSaving || !draft.trim() }} disabled={!editing || folderSaving || !draft.trim()} onPress={() => { void create(); }} style={{ width: view.layout.compact ? 44 : 32, height: view.layout.compact ? 42 : 30, alignItems: 'center', justifyContent: 'center', opacity: draft.trim() || folderSaving ? 1 : 0.4 }}>{folderSaving ? <StatusMark loadingColor={options.loadingColor} state="connecting" theme={view.theme} /> : <Glyph name="arrowRight" color={draft.trim() ? c.accent : c.foregroundMuted} />}</Pressable>
        </View>
      </View>
    </EntryReveal>
    {tabScope && !tabScope.tab.members.length && <View style={{padding:8,gap:4}}><Text style={{color:c.foregroundMuted,fontSize:12}}>{t('Add existing conversations to this tab.')}</Text><Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={t('Choose conversations…')} onPress={tabScope.openMembers} style={{minHeight:view.layout.compact?44:32,justifyContent:'center'}}><Text style={{color:c.accent,fontSize:13}}>{t('Choose conversations…')}</Text></Pressable></View>}
    {folderError && <Text accessibilityRole="alert" style={{ marginHorizontal: 8, marginBottom: 6, color: c.statusDanger, fontSize: 11, lineHeight: 16 }}>{folderError}</Text>}
    {selected && <Text style={{ color: c.foregroundMuted, fontSize: 12, padding: 8 }}>{t('Choose a folder for the selected conversation')}</Text>}
    {!search.trim() && <PinnedSection view={view} options={conversationOptions} items={pinnedItems} dense={short} row={reference => <ConversationRow key={`pinned:${reference.key}`} loadingColor={options.loadingColor} loadingEffect={options.loadingEffect} reference={reference} view={view} moving={false} select={() => {}} detailed={detailed} serverLabel={multiHost ? hosts.find(host => host.serverId === reference.hostId)?.label : undefined} />} />}
    {!search.trim() && <ActiveSection view={view} options={conversationOptions} dense={short} row={reference => <ConversationRow key={`active:${reference.key}`} loadingColor={options.loadingColor} loadingEffect={options.loadingEffect} reference={reference} view={view} moving={false} select={() => {}} detailed={detailed} serverLabel={multiHost ? hosts.find(host => host.serverId === reference.hostId)?.label : undefined} />} />}
    <SectionLabel view={view} dense={short} label={({ manual: t('Folders'), project: t('Projects'), server: t('Servers'), 'server-project': t('Servers') })[options.grouping]} />
    <Transition identity={`${options.grouping}:${targetHost}:${options.showTabs}`}>
    {options.grouping !== 'manual' && <AutomaticTree pickerTree={pickerTree} addConversations={addConversations} revision={settings.revision} assignedConversations={assigned} conversationOptions={conversationOptions} unfiledOrder={hostId => hostState(hostId)?.ungroupedOrder ?? []} folderAction={folderAction} createFolder={createHostFolder} foldersForHost={hostId => presentationHostState(hostId)?.groups ?? []} mode={options.grouping} hosts={pickedHost ? hosts.filter(host => host.serverId === pickedHost) : hosts} view={view} row={conversationRow} />}
    {options.grouping === 'manual' && [...state.groups.filter(g => !g.parentId).flatMap(g => [g, ...(!g.projectKey && isExpanded(g.id) ? state.groups.filter(child => child.parentId === g.id) : [])]), { id: 'ungrouped', name: t('Unfiled'), agentIds: visible.filter(a => !assigned.has(`${a.hostId}:${a.id}`)).map(a => a.id) }].map(group => {
      if ('projectKey' in group && group.projectKey) return <ProjectFolder key={group.id} group={group} groups={state.groups} hostId={targetHost!} view={view} row={conversationRow} folderAction={folderAction} pickerTree={pickerTree} addConversations={addConversations} revision={settings.revision} options={conversationOptions} chooseDestination={selected ? destination => { const source = memberRef(targetHost!, selected); void dropConversation({hostId:source.hostId,agentId:source.agentId}, destination).then(ok => { if(ok) setSelected(null); }); } : undefined} foldersForHost={hostId => presentationHostState(hostId)?.groups ?? []} />;
      const displayGroup = displayedState.groups.find(candidate => candidate.id === group.id) ?? group;
      const sourceIds = group.id === 'ungrouped' ? [...new Set([...state.ungroupedOrder, ...group.agentIds])] : group.agentIds;
      const memberAgents = filteredAgents.filter(agent => containsMember(group.agentIds, targetHost!, agent.hostId, agent.id));
      const rows = conversationOptions.sortBy === 'manual' ? sourceIds.flatMap(id => { const member = memberRef(targetHost!, id); return memberAgents.filter(agent => agent.id === member.agentId && agent.hostId === member.hostId); }) : memberAgents;
      const open = isExpanded(group.id);
      const members = [...displayGroup.agentIds, ...displayedState.groups.filter(child => child.parentId === group.id).flatMap(child => child.agentIds)];
      const folderStatus = aggregateStates(stateGroups.filter(bucket => bucket.items.some(agent => containsMember(members, targetHost!, agent.hostId, agent.id))).map(bucket => bucket.key));
      return <FolderArrival key={group.id} fresh={group.id === freshFolderId}><View style={{ minWidth: 0, marginLeft: 'parentId' in group && group.parentId ? 12 : 0 }}>
        <FolderDropTarget hostId={targetHost!} group={group.id === 'ungrouped' ? undefined : group} root={group.id === 'ungrouped'} view={view} activate={() => expand(group.id)}><DragFolderRow disabled={group.id === 'ungrouped'} source={{hostId:targetHost!,groupId:group.id}}><ConversationDropTarget destination={{ hostId: targetHost!, groupId: group.id === 'ungrouped' ? null : group.id }} view={view} activate={() => expand(group.id)}><View style={{ ...feedback, flexDirection: 'row', alignItems: 'center', borderRadius: 6 }}>
        <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={`Folder ${group.name}`} accessibilityState={{ expanded: open }} onPress={() => { if (selected) void dropConversation((() => {const source=memberRef(targetHost!,selected);return {hostId:source.hostId,agentId:source.agentId};})(),{hostId:targetHost!,groupId:group.id === 'ungrouped' ? null : group.id}).then(ok => { if (ok) setSelected(null); }); else toggle(group.id); }} style={({ pressed }) => ({ minHeight: view.layout.compact ? 44 : 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 8, flex: 1, minWidth: 0, backgroundColor: pressed ? c.surface2 : 'transparent', borderWidth: 1, borderColor: 'transparent' })}>
          <Disclosure open={open} color={c.foregroundMuted} /><BranchIcon loadingColor={options.loadingColor} loadingEffect={options.loadingEffect} state={folderStatus.state} hasUpdates={folderStatus.hasUpdates} open={open} icon="folder" theme={view.theme} /><Text numberOfLines={1} style={{ color: c.foreground, fontSize: 13, fontWeight: '600', flex: 1 }}>{group.name}</Text><Text style={{ color: c.foregroundMuted, fontSize: 11 }}>{rows.length}</Text>
        </Pressable>
        {group.id !== 'ungrouped' && <><ConversationViewContext.Provider value={{options:conversationOptions,pickerTree,foldersForHost:hostId=>presentationHostState(hostId)?.groups??[],unfiledOrder:()=>[],addConversations,revision:settings.revision}}><FolderAdd hostId={targetHost!} group={group} view={view} /></ConversationViewContext.Provider>{button('⋮', () => { setMenu(menu === group.id ? null : group.id); setPicker(null); })}</>}
        </View></ConversationDropTarget></DragFolderRow></FolderDropTarget>
        <Reveal open={menu === group.id}><View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 4, backgroundColor: c.surface1 }}>
          {!('parentId' in group && group.parentId) && button('New subfolder', () => { rememberFolderRevision(); setParentId(group.id); setRenaming(null); setDraft(''); setFolderError(null); setEditing(true); setMenu(null); })}
          {button('Rename', () => { rememberFolderRevision(); setRenaming(group.id); setDraft(group.name); setFolderError(null); setEditing(true); setMenu(null); })}
          {button('Move up', () => { const siblings = state.groups.filter(candidate => (candidate.parentId ?? null) === ('parentId' in group ? group.parentId ?? null : null) && !!candidate.topLevel === !!('topLevel' in group && group.topLevel)); const index = siblings.findIndex(candidate => candidate.id === group.id); if (index > 0) void dropFolder({hostId:targetHost!,groupId:group.id},{hostId:targetHost!,parentId:'parentId' in group ? group.parentId ?? null : null,topLevel:!!('topLevel' in group && group.topLevel),siblingId:siblings[index - 1].id,position:'before'}); })}
          {button('Delete folder', () => { void folderAction(targetHost!, group, 'delete'); setMenu(null); })}
        </View></Reveal>
        <Reveal open={picker === group.id}><View style={{ padding: 6, backgroundColor: c.surface1 }}>
          <Text style={{ color: c.foregroundMuted, fontSize: 11, padding: 6 }}>{t('Add conversations to this folder')}</Text>
          {allAgents.filter(a => !containsMember(group.agentIds,targetHost!,a.hostId,a.id)).map(reference => <AddConversation key={reference.key} reference={reference} view={view} add={() => { void dropConversation({hostId:reference.hostId,agentId:reference.id},{hostId:targetHost!,groupId:group.id}).then(ok => { if (ok) { setPicker(null); expand(group.id); } }); }} />)}
          {button('Close', () => setPicker(null))}
        </View></Reveal>
        <Reveal open={open}><FolderDropTarget hostId={targetHost!} group={group.id === 'ungrouped' ? undefined : group} root={group.id === 'ungrouped'} insideOnly view={view}><ConversationDropTarget destination={{ hostId: targetHost!, groupId: group.id === 'ungrouped' ? null : group.id }} view={view}><View style={{ minHeight: view.layout.compact ? 36 : 28 }}>{rows.map(reference => conversationRow(reference, group.id === 'ungrouped' ? null : group.id, targetHost!))}{!rows.length && <Text style={{ color: c.foregroundMuted, fontSize: 10, paddingHorizontal: 12, paddingVertical: 4 }}>{search || conversationOptions.filter !== 'all' ? t('No matching conversations') : t('Drop conversations here')}</Text>}</View></ConversationDropTarget></FolderDropTarget></Reveal>
      </View></FolderArrival>;
    })}
    </Transition>
    {(settings.saveError || extraSettings.saveError || preferences.saveError) && <Text style={{ color: c.statusDanger, padding: 8 }}>{settings.saveError || extraSettings.saveError || preferences.saveError}</Text>}
  </TouchScrollView></TouchDragProvider></ConversationDragProvider></FolderDragProvider></PinsContext.Provider>;
}

function AddConversation({ reference, view, add }: { reference: AgentRef; view: PluginSidebarViewProps; add(): void }) {
  const title = useAgent(reference, agent => agent.title);
  return <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={`Add ${title || 'Untitled conversation'}`} onPress={add} style={{ minHeight: view.layout.compact ? 44 : 36, padding: 8 }}><Text numberOfLines={2} style={{ color: view.theme.colors.foreground, fontSize: 12 }}>＋ {title || 'Untitled conversation'}</Text></Pressable>;
}

function SectionLabel({ view, label, open, toggle, dense }: { view: PluginSidebarViewProps; label: string; open?: boolean; toggle?(): void; dense?: boolean }) {
  const c = view.theme.colors;
  const text = <Text selectable={false} style={{ flex: 1, color: c.foregroundMuted, fontSize: 12, fontWeight: '500' }}>{label}</Text>;
  const style = { minHeight: view.layout.compact ? 36 : dense ? 24 : 28, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 } as const;
  return toggle ? <Pressable theme={view.theme} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={toggle} style={style}>{text}<Disclosure open={!!open} color={c.foregroundMuted} /></Pressable> : <View style={style}>{text}</View>;
}

const urgency = (state: string) => state === 'permission' || state === 'error' ? 0 : state === 'updated' ? 1 : 2;
/** What is running, waiting on the user, or finished unread, across every project; quiet subtasks stay with their parent. */
function ActiveSection({ view, options, row, dense }: { view: PluginSidebarViewProps; options: ConversationOptions; row(reference: AgentRef): ReactNode; dense?: boolean }) {
  // A short sidebar starts this folded: its rows also sit at the top of their projects. An explicit open is remembered.
  const [open, setOpen] = useBranchOpen('active', !dense);
  const active = useSteadyList(useAgents({
    where: agent => ['running', 'permission', 'error', 'updated'].includes(conversationState(agent)) && !quietSubtask(agent) && matchesConversation(agent, { ...options, parents: undefined }),
    orderBy: (a, b) => urgency(conversationState(a)) - urgency(conversationState(b)) || (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''),
  }));
  if (!active.length) return null;
  return <View style={{ minWidth: 0, marginBottom: 6 }}>
    <SectionLabel view={view} dense={dense} label={`${t('In progress')} · ${active.length}`} open={open} toggle={() => setOpen(!open)} />
    <Reveal open={open}>{active.slice(0, dense ? 3 : view.layout.compact ? 4 : 8).map(row)}</Reveal>
  </View>;
}

/** Pinned conversations, newest pin first, across every project. They leave the lists below until unpinned. */
function PinnedSection({ view, options, items, row, dense }: { view: PluginSidebarViewProps; options: ConversationOptions; items: readonly { hostId: string; agentId: string }[]; row(reference: AgentRef): ReactNode; dense?: boolean }) {
  const [open, setOpen] = useBranchOpen('pinned');
  const order = new Map(items.map((item, index) => [pinKey(item.hostId, item.agentId), index]));
  const pinned = useSteadyList(useAgents({
    where: agent => order.has(pinKey(agent.hostId, agent.id)) && matchesConversation(agent, { ...options, parents: undefined, pinned: undefined }),
    orderBy: (a, b) => (order.get(pinKey(a.hostId, a.id)) ?? 0) - (order.get(pinKey(b.hostId, b.id)) ?? 0),
  }));
  if (!pinned.length) return null;
  return <View style={{ minWidth: 0, marginBottom: 6 }}>
    <SectionLabel view={view} dense={dense} label={`${t('Pinned')} · ${pinned.length}`} open={open} toggle={() => setOpen(!open)} />
    <Reveal open={open}>{pinned.map(row)}</Reveal>
  </View>;
}

/** A parent conversation with its subtasks folded below it; children mount only while open. */
function SubtaskGroup({ parentKey, kids, alert, row, child }: { parentKey: string; kids: readonly AgentRef[]; alert: boolean; row(chip: SubtaskChip): ReactNode; child(reference: AgentRef): ReactNode }) {
  const [open, setOpen] = useBranchOpen(`subtasks:${parentKey}`, false);
  return <View style={{ minWidth: 0 }}>
    {row({ count: kids.length, open, alert, toggle: () => setOpen(!open) })}
    <Reveal open={open}><View style={{ marginLeft: 22, minWidth: 0 }}>{open && kids.map(child)}</View></Reveal>
  </View>;
}
