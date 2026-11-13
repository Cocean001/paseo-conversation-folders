import { useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useAgent, useAgents, useHosts, useWorkspaces, useSettings, type AgentRef, type PluginSidebarViewProps } from '@getpaseo/plugin/client';
import { ActionDialog } from './action-dialog';
import { FeedbackPressable, Glyph, Disclosure, useMotion } from './visuals';
import { useConversationView } from './conversation-view';
import { projectAppearance } from '../shared/settings';
import type { PickerBranch } from '../shared/folder-picker';
import { Image } from 'react-native';
import { conversationOrder } from '../shared/conversations';
import { containsMember, memberId, type Group } from '../shared/model';

function Choice({ reference, checked, disabled, toggle, view }: { reference: AgentRef; checked: boolean; disabled: boolean; toggle(): void; view: PluginSidebarViewProps }) {
  const title = useAgent(reference, agent => agent.title);
  return <FeedbackPressable theme={view.theme} accessibilityRole="checkbox" accessibilityLabel={`Include ${title || 'Untitled conversation'} in folder`} aria-checked={checked} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={toggle} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, backgroundColor: checked ? view.theme.colors.surface2 : undefined }}>
    <View style={{width:16,height:16,borderWidth:1,borderColor:checked?view.theme.colors.accent:view.theme.colors.border,borderRadius:3,alignItems:'center',justifyContent:'center'}}>{checked && <Glyph name="check" size={12} color={view.theme.colors.accent} />}</View><Text style={{ color: view.theme.colors.foreground, flex: 1, fontSize: 12 }}>{title || 'Untitled conversation'}</Text>
  </FeedbackPressable>;
}

function CurrentBranch({ branch, expanded, toggleOpen, references, group, hostId, selected, changeSelection, busy, view }: {
  branch: PickerBranch; expanded: Set<string>; toggleOpen(id: string): void; references: readonly AgentRef[]; group: Group; hostId: string;
  selected: AgentRef[]; changeSelection: import('react').Dispatch<import('react').SetStateAction<AgentRef[]>>; busy: boolean; view: PluginSidebarViewProps;
}) {
  const appearance = useSettings(projectAppearance);
  const custom = appearance.status === 'ready' && branch.projectKey ? appearance.values.projects[branch.projectKey] : undefined;
  const c = view.theme.colors;
  const title = custom?.name || branch.title;
  const open = expanded.has(branch.id);
  const { options } = useConversationView();
  const choices = useAgents({ where: agent => references.some(ref => ref.hostId === agent.hostId && ref.id === agent.id) && branch.members.some(member => member.hostId === agent.hostId && member.agentId === agent.id) && !containsMember(group.agentIds, hostId, agent.hostId, agent.id), orderBy: conversationOrder(options, branch.members.map(member => memberId(hostId, member.hostId, member.agentId)), hostId) });
  const allSelected = choices.length > 0 && choices.every(ref => selected.some(item => item.key === ref.key));
  return <View>
    <FeedbackPressable theme={view.theme} accessibilityRole="button" accessibilityLabel={`Current: ${title}`} accessibilityState={{expanded:open,disabled:busy}} disabled={busy} onPress={()=>toggleOpen(branch.id)} style={{minHeight:40,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:8}}>
      <Disclosure open={open} color={c.foregroundMuted}/>
      {custom?.image?<Image source={{uri:custom.image}} style={{width:16,height:16,borderRadius:3}}/>:<Glyph name={custom?.icon||branch.icon} color={custom?.color||c.foregroundMuted} size={16}/>}
      <Text numberOfLines={1} style={{color:c.foreground,fontSize:12,flex:1}}>{title}</Text><Text style={{color:c.foregroundMuted,fontSize:11}}>{choices.length}</Text>
    </FeedbackPressable>
    {open&&<View style={{marginLeft:16,paddingRight:8,paddingBottom:4}}>
      {choices.length>0&&<FeedbackPressable theme={view.theme} accessibilityRole="button" accessibilityLabel={allSelected?'Deselect all conversations':'Select all conversations'} disabled={busy} onPress={()=>changeSelection(previous=>allSelected?previous.filter(item=>!choices.some(ref=>ref.key===item.key)):[...previous,...choices.filter(ref=>!previous.some(item=>item.key===ref.key))])} style={{minHeight:32,paddingHorizontal:8,justifyContent:'center'}}><Text style={{color:c.accent,fontSize:11}}>{allSelected?'Deselect all':'Select all'}</Text></FeedbackPressable>}
      {choices.map(reference=><Choice key={reference.key} reference={reference} checked={selected.some(item=>item.key===reference.key)} disabled={busy} view={view} toggle={()=>changeSelection(previous=>previous.some(item=>item.key===reference.key)?previous.filter(item=>item.key!==reference.key):[...previous,reference])}/>)}
      {branch.children.map(child=><CurrentBranch key={child.id} branch={child} expanded={expanded} toggleOpen={toggleOpen} references={references} group={group} hostId={hostId} selected={selected} changeSelection={changeSelection} busy={busy} view={view}/>)}
      {!choices.length&&!branch.children.length&&<Text style={{color:c.foregroundMuted,padding:8,fontSize:11}}>No conversations to add</Text>}
    </View>}
  </View>;
}

/** Select connected sources; only sidebar assignments are saved. */
export function FolderAdd({ hostId, group, view }: { hostId: string; group: Group; view: PluginSidebarViewProps }) {
  const { addConversations, revision, pickerTree = [] } = useConversationView();
  const hosts = useHosts();
  const workspaces = useWorkspaces({ groupBy: workspace => ({ key: workspace.ref.key, title: workspace.title || workspace.name || workspace.projectDisplayName }) });
  const buckets = useAgents({ groupBy: agent => agent.workspace.key });
  const [pickerView, setPickerView] = useState<'current' | 'original'>('current');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [sourceHost, setSourceHost] = useState<string | null>(null);
  const [workspaceKey, setWorkspaceKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgentRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false), openedRevision = useRef(revision);
  const close = () => { if (!pending.current) setOpen(false); };
  const c = view.theme.colors;
  const [plusHovered, setPlusHovered] = useState(false);
  const plusHighlight = useMotion(plusHovered ? 1 : 0);
  const button = (label: string, action: () => void, disabled = busy) => <FeedbackPressable theme={view.theme} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={action} style={{ minHeight: 40, paddingHorizontal: 8, justifyContent: 'center', backgroundColor: c.surface1, borderRadius: 5 }}><Text style={{ color: c.foreground, fontSize: 12 }}>{label === 'Cancel adding conversations' ? 'Cancel' : label === 'Add selected conversations' ? selected.length ? `Add ${selected.length} ${selected.length === 1 ? 'conversation' : 'conversations'}` : 'Add conversations' : label}</Text></FeedbackPressable>;
  return <>
    <FeedbackPressable theme={view.theme} hoverBackground="transparent" onHoverIn={() => setPlusHovered(true)} onHoverOut={() => setPlusHovered(false)} onFocus={() => setPlusHovered(true)} onBlur={() => setPlusHovered(false)} accessibilityRole="button" accessibilityLabel={`Add conversations to ${group.name}`} disabled={!addConversations} onPress={() => { openedRevision.current = revision; setSelected([]); setPickerView('current'); setExpanded(new Set()); setSourceHost(hosts.length===1?hosts[0].serverId:null); setWorkspaceKey(null); setError(null); setOpen(true); }} style={{ width: view.layout.compact ? 44 : 32, minHeight: view.layout.compact ? 44 : 36, alignItems: 'center', justifyContent: 'center', position: 'relative' }}><Animated.View pointerEvents="none" style={{position:'absolute',width:24,height:24,borderRadius:5,backgroundColor:c.surface2,opacity:plusHighlight}} /><Glyph name="plus" color={c.foregroundMuted} /></FeedbackPressable>
    <ActionDialog open={open} title="Add conversations" busy={busy} close={close} view={view}>
      <Text style={{color:c.foregroundMuted,fontSize:12}}>Choose conversations for “{group.name}”.</Text>
      <View accessibilityRole="tablist" style={{flexDirection:'row',padding:3,gap:3,borderRadius:6,backgroundColor:c.surface1}}>
        {([['current','Current layout'],['original','Original sources']] as const).map(([value,label])=><FeedbackPressable key={value} theme={view.theme} accessibilityRole="tab" accessibilityLabel={label} aria-selected={pickerView===value} accessibilityState={{selected:pickerView===value,disabled:busy}} disabled={busy} onPress={()=>setPickerView(value)} style={{flex:1,minHeight:36,alignItems:'center',justifyContent:'center',borderRadius:4,backgroundColor:pickerView===value?c.surface2:undefined}}><Text style={{color:pickerView===value?c.foreground:c.foregroundMuted,fontSize:12}}>{label}</Text></FeedbackPressable>)}
      </View>
      <Text style={{color:c.foregroundMuted,fontSize:11}}>{pickerView==='current'?'Move from your sidebar’s folders and projects.':'Browse conversations by server and workspace.'}</Text>
      {pickerView==='current'?<View style={{borderWidth:1,borderColor:c.border,borderRadius:6,overflow:'hidden'}}>
        {pickerTree.map(branch=><CurrentBranch key={branch.id} branch={branch} expanded={expanded} toggleOpen={id=>setExpanded(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next})} references={buckets.flatMap(bucket=>bucket.items)} group={group} hostId={hostId} selected={selected} changeSelection={setSelected} busy={busy} view={view}/>)}
        {!pickerTree.length&&<Text style={{color:c.foregroundMuted,padding:12,fontSize:12}}>No conversations in the current layout. Browse Original sources.</Text>}
      </View>:<View style={{borderWidth:1,borderColor:c.border,borderRadius:6,overflow:'hidden'}}>
        {hosts.map(host => {
          const expanded = sourceHost === host.serverId;
          const offline = !!host.status && host.status !== 'online';
          const hostWorkspaces = workspaces.filter(workspace=>workspace.items.some(ref=>ref.hostId===host.serverId));
          return <View key={host.serverId}>
            <FeedbackPressable theme={view.theme} accessibilityRole="button" accessibilityLabel={`Server: ${host.label}`} accessibilityState={{expanded,disabled:offline||busy}} disabled={offline||busy} onPress={()=>{setSourceHost(expanded?null:host.serverId);setWorkspaceKey(null)}} style={{minHeight:40,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:c.surface1}}>
              <Disclosure open={expanded} color={c.foregroundMuted}/><Glyph name="server" color={c.foregroundMuted}/><Text style={{color:c.foreground,fontSize:12,flex:1}}>{host.label}</Text><Text style={{color:c.foregroundMuted,fontSize:11}}>{offline?'Offline':`${hostWorkspaces.length} workspaces`}</Text>
            </FeedbackPressable>
            {expanded && hostWorkspaces.map(workspace=>{
              const workspaceOpen=workspaceKey===workspace.key;
              const choices=buckets.filter(bucket=>bucket.key===workspace.key).flatMap(bucket=>bucket.items).filter(ref=>ref.hostId===host.serverId&&!containsMember(group.agentIds,hostId,ref.hostId,ref.id));
              const allSelected=choices.length>0&&choices.every(ref=>selected.some(item=>item.key===ref.key));
              return <View key={workspace.key} style={{marginLeft:16}}>
                <FeedbackPressable theme={view.theme} accessibilityRole="button" accessibilityLabel={`Workspace: ${workspace.title || 'Untitled workspace'}`} accessibilityState={{expanded:workspaceOpen}} disabled={busy} onPress={()=>setWorkspaceKey(workspaceOpen?null:workspace.key)} style={{minHeight:40,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:8}}>
                  <Disclosure open={workspaceOpen} color={c.foregroundMuted}/><Glyph name="folder" color={c.foregroundMuted}/><Text style={{color:c.foreground,fontSize:12,flex:1}}>{workspace.title || 'Untitled workspace'}</Text><Text style={{color:c.foregroundMuted,fontSize:11}}>{choices.length}</Text>
                </FeedbackPressable>
                {workspaceOpen && <View style={{marginLeft:24,paddingRight:8,paddingBottom:8}}>
                  {choices.length>0 && <FeedbackPressable theme={view.theme} accessibilityRole="button" accessibilityLabel={allSelected?'Deselect all conversations':'Select all conversations'} disabled={busy} onPress={()=>setSelected(previous=>allSelected?previous.filter(item=>!choices.some(ref=>ref.key===item.key)):[...previous,...choices.filter(ref=>!previous.some(item=>item.key===ref.key))])} style={{minHeight:32,paddingHorizontal:8,justifyContent:'center'}}><Text style={{color:c.accent,fontSize:11}}>{allSelected?'Deselect all':'Select all'}</Text></FeedbackPressable>}
                  {choices.map(reference=><Choice key={reference.key} reference={reference} checked={selected.some(item=>item.key===reference.key)} disabled={busy} view={view} toggle={()=>setSelected(previous=>previous.some(item=>item.key===reference.key)?previous.filter(item=>item.key!==reference.key):[...previous,reference])}/>)}
                  {!choices.length&&<Text style={{color:c.foregroundMuted,fontSize:12,padding:8}}>No conversations to add</Text>}
                </View>}
              </View>;
            })}
            {expanded&&!hostWorkspaces.length&&<Text style={{color:c.foregroundMuted,fontSize:12,padding:12}}>No workspaces on this server</Text>}
          </View>;
        })}
        {!hosts.length&&<Text style={{color:c.foregroundMuted,padding:12}}>No connected servers</Text>}
      </View>}
      <Text style={{ color: c.foregroundMuted, fontSize: 11 }}>{selected.length} selected</Text>
      {error && <Text accessibilityRole="alert" style={{ color: c.statusDanger, fontSize: 12 }}>{error}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
        {button('Cancel adding conversations', close)}
        {button(busy ? 'Adding conversations…' : 'Add selected conversations', () => {
          if (pending.current || !selected.length || !addConversations) return;
          pending.current = true; setBusy(true); setError(null);
          void addConversations(selected, { hostId, groupId: group.id }, openedRevision.current).then(saved => { if (saved) setOpen(false); else setError('Could not save. The folder may have changed; close and reopen this picker, then retry.'); }).catch(() => setError('Could not add conversations. Check the server connection and retry.')).finally(() => { pending.current = false; setBusy(false); });
        }, busy || !selected.length)}
      </View>
    </ActionDialog>
  </>;
}
