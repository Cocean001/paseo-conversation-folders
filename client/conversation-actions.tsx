import { ActionDialog } from './action-dialog';
import { showConversationTooltip, isSidebarDragging } from './web';
import { activityTime } from '../shared/activity';
import { hostContext } from '../shared/host-context';
import { deleteConversation, renameConversation } from '../shared/conversation-actions';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text } from 'react-native';
import { useAgent, useWorkspace, useHosts, usePaseo, useRpc, type AgentRef, type PluginSidebarViewProps } from '@getpaseo/plugin/client';
import { TextInput, copyText } from '@getpaseo/plugin/client/ui';
import { ContextMenu, type MenuPoint, type MenuAction } from './context-menu';
import { ActionRow, FeedbackPressable, Glyph } from './visuals';
import { t, timeLabel } from './i18n';

type Dialog = 'rename-agent' | 'rename' | 'labels' | 'archive-agent' | 'archive-workspace' | 'delete-agent';
/** Actions stay attached to the conversation's source host, including mixed-host folders. */
export function ConversationActions({ reference, view, children }: { reference: AgentRef; view: PluginSidebarViewProps; children(openMenu: () => void): ReactNode }) {
  const paseo = usePaseo();
  const removeConversation = useRpc(deleteConversation);
  const renameAgent = useRpc(renameConversation);
  const readHost = useRpc(hostContext);
  const [ownerHost, setOwnerHost] = useState<string | null>(null);
  useEffect(() => { let active = true; void readHost({}).then(value => { if(active) setOwnerHost(value.hostId); }).catch(() => {}); return () => { active = false; }; }, [readHost]);
  const agent = useAgent(reference, a => ({ title: a.title, workspace: a.workspace, lastActivityAt:a.lastActivityAt }));
  const workspace = useWorkspace(agent?.workspace ?? {kind: 'workspace', key: `${reference.hostId}:missing`, hostId: reference.hostId, id: '__missing__'}, w => ({ name: w.name, title: w.title, directory: w.directory, branch: w.branch, pinned: !!w.pinnedAt, labels: w.labels }));
  const hosts = useHosts();
  const [hovered, setHovered] = useState(false);
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const more = useRef<View>(null);
  const row = useRef<View>(null);
  const c = view.theme.colors;
  const title = agent?.title || t('Untitled conversation');
  const sourceHostName = hosts.find(host => host.serverId === reference.hostId)?.label || 'Disconnected server';
  const hostName = /macbook/i.test(sourceHostName) ? 'MacBook' : sourceHostName;
  const hideTooltip = useRef<() => void>(() => {});
  useEffect(() => {
    if (!hovered || anchor || dialog || view.layout.compact || view.layout.platform !== 'web') return;
    const timer = setTimeout(() => { hideTooltip.current = showConversationTooltip(row.current, { title, host:hostName, path:workspace?.directory }, c); }, 650);
    return () => { clearTimeout(timer); hideTooltip.current(); };
  }, [hovered, anchor, dialog, view.layout.compact, view.layout.platform, title, hostName, workspace?.directory, c]);
  // Touch rows have no menu button; long-press anchors the menu under the row instead.
  const open = () => { if (isSidebarDragging(row.current)) return; (more.current ?? row.current)?.measureInWindow((x,y,width,height) => setAnchor({x:x+width-208,y:y+height+4})); };
  const edit = (kind: Dialog) => { setError(null); setDraft(kind === 'rename-agent' ? title : kind === 'rename' ? workspace?.title || workspace?.name || '' : ''); setDialog(kind); };
  async function run(action: () => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try { await action(); setDialog(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not complete action. Check the source host connection and try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  const workspaceHandle = () => { if (!agent) throw new Error('This conversation is no longer available.'); return paseo.workspaces.ref(agent.workspace); };
  const actions: MenuAction[] = [
    { id: 'open-workspace', label: t('Open workspace'), disabled: !agent || busy, onSelect: () => { if (agent) view.navigation.openWorkspace(agent.workspace); } },
    { id: 'copy-path', label: t('Copy path'), disabled: !workspace || busy, onSelect: () => { void run(() => copyText(workspace!.directory)); } },
    { id: 'copy-branch', label: t('Copy branch name'), disabled: !workspace?.branch || busy, onSelect: () => { void run(() => copyText(workspace!.branch!)); } },
    { id: 'rename-agent', label: t('Rename conversation…'), disabled: !agent || busy || ownerHost !== reference.hostId, onSelect: () => edit('rename-agent') },
    { id: 'rename', label: t('Rename workspace…'), disabled: !workspace || busy, onSelect: () => edit('rename') },
    { id: 'pin', label: workspace?.pinned ? t('Unpin workspace') : t('Pin workspace'), disabled: !workspace || busy, onSelect: () => { void run(() => workspaceHandle().setPinned(!workspace?.pinned)); } },
    { id: 'labels', label: t('Labels…'), disabled: !workspace || busy, onSelect: () => edit('labels') },
    { id: 'archive-agent', label: t('Archive conversation…'), disabled: !agent || busy, onSelect: () => edit('archive-agent') },
    { id: 'delete-agent', label: t('Delete conversation…'), danger: true, disabled: !agent || busy || ownerHost !== reference.hostId, onSelect: () => edit('delete-agent') },
    { id: 'archive-workspace', label: t('Archive workspace…'), disabled: !workspace || busy, onSelect: () => edit('archive-workspace') },
  ];
  const close = () => { if (!pending.current) { setDialog(null); setError(null); } };
  const submit = () => {
    if (!dialog || ((dialog === 'rename-agent' || dialog === 'labels') && !draft.trim())) return;
    void run(async () => {
      if (dialog === 'delete-agent') {
        await removeConversation({ hostId: reference.hostId, agentId: reference.id, confirmAgentId: reference.id });
      } else if (dialog === 'rename-agent') {
        const title = draft.trim();
        const result = await renameAgent({ hostId: reference.hostId, agentId: reference.id, title });
        if (!result.renamed || result.title !== title) throw new Error('The host did not confirm the new conversation name. Try again.');
        // An empty top-level patch preserves metadata and broadcasts the new snapshot.
        await paseo.agents.ref(reference).setMetadata({});
      } else if (dialog === 'rename') {
        const title = draft.trim() || null;
        const result = await workspaceHandle().setTitle(title);
        if (result.title !== title) throw new Error('The host did not confirm the new workspace name. Try again.');
      } else if (dialog === 'labels') {
        await workspaceHandle().setLabel(draft.trim(), { assigned: true });
      } else if (dialog === 'archive-agent') {
        const result = await paseo.agents.ref(reference).archive();
        if (!result.archivedAt) throw new Error('The host did not confirm archiving. Try again.');
      } else if (dialog === 'archive-workspace') {
        const result = await workspaceHandle().archive();
        if (result.error || !result.archivedAt) throw new Error(result.error || 'The host did not confirm archiving the workspace. Try again.');
      }
    });
  };
  const time = <Text selectable={false} accessibilityLabel={agent?.lastActivityAt ? `Last activity ${agent.lastActivityAt}` : undefined} numberOfLines={1} style={{color:c.foregroundMuted,fontSize:11,paddingRight:8}}>{timeLabel(activityTime(agent?.lastActivityAt))}</Text>;
  const contextEvents = view.layout.platform === 'web' ? {
    onContextMenu: (event: { preventDefault(): void; stopPropagation(): void; clientX: number; clientY: number }) => { event.preventDefault(); event.stopPropagation(); setAnchor({ x:event.clientX, y:event.clientY }); },
    onKeyDown: (event: { key: string; shiftKey: boolean; preventDefault(): void; stopPropagation(): void }) => { if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') { event.preventDefault(); event.stopPropagation(); row.current?.measureInWindow((x,y,width,height) => setAnchor({x:x+width-208,y:y+height})); } },
  } : {};
  return <View ref={row} style={{ minWidth: 0, paddingVertical: 2 }} onPointerEnter={event => { if(event.nativeEvent.pointerType !== 'touch')setHovered(true); }} onPointerLeave={() => setHovered(false)} {...contextEvents}>
    <ActionRow idleAction={view.layout.compact ? undefined : time} selected={view.active.agent?.key === reference.key} theme={view.theme} compact={view.layout.compact} active={!!anchor} persistent={!!anchor} action={view.layout.compact ? time : <View style={{flexDirection:'row',alignItems:'center'}}>
      <FeedbackPressable theme={view.theme} hoverBackground="transparent" accessibilityRole="button" accessibilityLabel={`Archive ${title}`} disabled={busy || !agent} onPress={() => edit('archive-agent')} style={{width:24,minHeight:30,alignItems:'center',justifyContent:'center'}}><Glyph name="archive" size={14} color={c.foregroundMuted} /></FeedbackPressable>
      <FeedbackPressable focusRef={more} theme={view.theme} hoverBackground="transparent" accessibilityRole="button" accessibilityLabel={`More actions for ${title}`} accessibilityState={{ expanded:!!anchor, disabled:busy }} disabled={busy} onPress={open} onLongPress={open} style={{ width:24, minHeight:30, alignItems:'center', justifyContent:'center' }}><Glyph name="moreVertical" size={13} color={c.foregroundMuted} /></FeedbackPressable>
    </View>}>
      <View style={{ flex:1, minWidth:0 }}>{children(open)}</View>
    </ActionRow>
    <ContextMenu anchor={anchor} close={() => setAnchor(null)} actions={actions} view={view} />
    {error && !dialog && <Text accessibilityRole="alert" style={{color:c.statusDanger,fontSize:11,padding:8}}>{error}</Text>}
    <ActionDialog view={view} busy={busy} close={close} title={dialog === 'rename-agent' ? t('Rename conversation') : dialog === 'rename' ? t('Rename workspace') : dialog === 'labels' ? t('Workspace labels') : dialog === 'archive-workspace' ? t('Archive workspace?') : dialog === 'delete-agent' ? t('Delete conversation permanently?') : t('Archive conversation?')} open={dialog !== null}>
        {dialog === 'rename-agent' || dialog === 'rename' || dialog === 'labels' ? <>
          {dialog === 'labels' && <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{workspace?.labels.map(label => <FeedbackPressable key={label} theme={view.theme} disabled={busy} accessibilityLabel={`Remove label ${label}`} onPress={() => { void run(async () => { await workspaceHandle().setLabel(label,{assigned:false}); }); }} style={{padding:8,backgroundColor:c.surface1}}><Text style={{color:c.foreground,fontSize:12}}>{label} ×</Text></FeedbackPressable>)}</View>}
          <TextInput accessibilityLabel={dialog === 'rename-agent' ? 'Conversation name' : dialog === 'rename' ? 'Workspace name' : 'New workspace label'} autoFocus value={draft} onChangeText={setDraft} editable={!busy} maxLength={120} onSubmitEditing={submit} placeholder={dialog === 'rename-agent' ? t('Conversation name') : dialog === 'rename' ? t('Default workspace name') : t('Label name')} placeholderTextColor={c.foregroundMuted} style={{color:c.foreground,backgroundColor:c.surface1,padding:10,borderRadius:5,minHeight:40}} />
        </> : <Text style={{color:c.foreground,fontSize:13}}>{dialog === 'delete-agent' ? t('Permanently delete “{0}” and its conversation history? Running work will stop. This cannot be undone. Workspace files and other conversations stay unchanged.', title) : dialog === 'archive-workspace' ? t('Archive “{0}” and all its conversations? Running work will stop. Files stay on disk.', workspace?.title || workspace?.name || t('Workspace')) : t('Archive “{0}”? Running work will stop. Other conversations in this workspace stay active.', title)}</Text>}
        {dialog === 'rename' && <Text style={{color:c.foregroundMuted,fontSize:11}}>{t('Changes the workspace name. Conversation and project names stay the same.')}</Text>}
        {dialog === 'labels' && <Text style={{color:c.foregroundMuted,fontSize:11}}>{t('Labels apply to the workspace and all its conversations.')}</Text>}
        {error && <Text accessibilityRole="alert" style={{color:c.statusDanger,fontSize:12}}>{error}</Text>}
        <View style={{flexDirection:'row',justifyContent:'flex-end',gap:8}}>
          <FeedbackPressable theme={view.theme} disabled={busy} onPress={close} accessibilityLabel="Cancel conversation action" style={{padding:10}}><Text style={{color:c.foregroundMuted}}>{t('Cancel')}</Text></FeedbackPressable>
          <FeedbackPressable theme={view.theme} disabled={busy || (dialog === 'labels' || dialog === 'rename-agent') && !draft.trim()} accessibilityLabel="Confirm conversation action" accessibilityState={{busy,disabled:busy || (dialog === 'labels' || dialog === 'rename-agent') && !draft.trim()}} onPress={submit} style={{padding:10,backgroundColor:c.surface2,borderRadius:5}}><Text style={{color:dialog === 'delete-agent' ? c.statusDanger : c.foreground}}>{busy ? t('Saving…') : dialog === 'delete-agent' ? t('Delete permanently') : dialog?.startsWith('archive') ? t('Archive') : dialog === 'labels' ? t('Add label') : t('Save')}</Text></FeedbackPressable>
        </View>
    </ActionDialog>
  </View>;
}
