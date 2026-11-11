import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useAgent, useAgents, useHosts, useRpc, useSettings, type AgentRef, type PluginSidebarViewProps } from '@getpaseo/plugin/client';
import { TextInput } from '@getpaseo/plugin/client/ui';
import { sidebarTabs } from '../shared/settings';
import { hostContext } from '../shared/host-context';
import { memberRef, type Organization } from '../shared/model';
import { addTabMembers, closeSidebarTab, createSidebarTab, reopenSidebarTab, selectTabMembers, updateSidebarTab, type SidebarTab, type SidebarTabs, type TabMember } from '../shared/sidebar-tabs';
import { DropdownMenu, type DropdownAnchor, type DropdownItem } from './dropdown-menu';
import { FeedbackPressable, Glyph } from './visuals';

export interface SidebarTabControls { enabled:boolean; saving:boolean; items:DropdownItem[] }
export interface SidebarTabScope {
  tab: SidebarTab;
  revision: string;
  saving: boolean;
  error: string | null;
  saveOrganization(values: Organization, revision: string, hosts?: Record<string, Organization>): Promise<boolean>;
  saveHosts(values: {hosts:Record<string, Organization>}, revision: string): Promise<boolean>;
  openMembers(): void;
}
function MemberChoice({ reference, checked, disabled, view, toggle }: { reference: AgentRef; checked: boolean; disabled:boolean; view:PluginSidebarViewProps; toggle():void }) {
  const title = useAgent(reference, agent => agent.title);
  const hosts = useHosts().map(host=>({...host,label:/macbook/i.test(host.label)?'MacBook':host.label}));
  return <FeedbackPressable theme={view.theme} accessibilityRole="checkbox" accessibilityLabel={`Include ${title || 'Untitled conversation'} in tab`} accessibilityState={{checked,disabled}} disabled={disabled} onPress={toggle} style={{minHeight:44,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:8,backgroundColor:checked?view.theme.colors.surface2:undefined}}>
    <View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={{color:view.theme.colors.foreground,fontSize:12}}>{title || 'Untitled conversation'}</Text><Text style={{color:view.theme.colors.foregroundMuted,fontSize:10}}>{hosts.find(host=>host.serverId===reference.hostId)?.label || 'Disconnected server'}</Text></View>
    {checked && <Glyph name="check" color={view.theme.colors.foreground} />}
  </FeedbackPressable>;
}
/** All retains the original organization; custom tabs store independent views of existing chats. */
export function SidebarTabsView({ view, children }: {view:PluginSidebarViewProps; children(scope:SidebarTabScope|undefined, controls:SidebarTabControls):ReactNode}) {
  const settings = useSettings(sidebarTabs);
  const readHost = useRpc(hostContext);
  const [ownerHost, setOwnerHost] = useState<string | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);
  useEffect(()=>{let active=true;void readHost({}).then(value=>{if(active){setOwnerHost(value.hostId);setHostError(null)}}).catch(()=>{if(active)setHostError('Could not load the tab host. Check the connection and reload.');});return()=>{active=false}},[readHost]);
  const [dialog,setDialog]=useState<'new'|'rename'|'members'|null>(null);
  const [draft,setDraft]=useState('');
  const [memberSearch,setMemberSearch]=useState('');
  const [dialogRevision,setDialogRevision]=useState<string|undefined>();
  const [memberDraft,setMemberDraft]=useState<TabMember[]>([]);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const pending=useRef(false);
  const menuRef=useRef<View>(null);
  const tabScroll=useRef<ScrollView>(null);
  const tabPositions=useRef<Record<string,number>>({});
  const [menuAnchor,setMenuAnchor]=useState<DropdownAnchor|null>(null);
  const state:SidebarTabs = settings.status==='ready'?settings.values:{enabled:true,activeId:'all',tabs:[]};
  const active=state.enabled?state.tabs.find(tab=>tab.id===state.activeId&&tab.open):undefined;
  useEffect(()=>{tabScroll.current?.scrollTo({x:Math.max(0,(tabPositions.current[active?.id || 'all'] || 0)-24),animated:false})},[active?.id,state.enabled,state.tabs.length]);
  const agents=useAgents({where:agent=>!memberSearch.trim()||(agent.title||'Untitled conversation').toLocaleLowerCase().includes(memberSearch.trim().toLocaleLowerCase()),orderBy:'title'});
  const c=view.theme.colors;
  async function save(next:SidebarTabs,revision?:string) {
    if(settings.status!=='ready'||pending.current)return false;
    if(revision && revision!==settings.revision){setError('The tabs changed on another client. Close this editor and try again.');return false;}
    pending.current=true;setSaving(true);setError(null);
    try{const ok=await settings.save(next,settings.revision);if(!ok)setError('Could not save tabs. Refresh and try again.');return ok;}
    catch{setError('Could not save tabs. Check the host connection.');return false;}
    finally{pending.current=false;setSaving(false);}
  }
  const resetDialog=()=>{if(!pending.current){setDialog(null);setError(null)}};
  const openNew=()=>{setDraft('');setError(null);setDialogRevision(settings.status==='ready'?settings.revision:undefined);setDialog('new');setMenuAnchor(null)};
  const openMembers=()=>{if(active){setDialogRevision(settings.status==='ready'?settings.revision:undefined);setMemberDraft([...active.members]);setMemberSearch('');setError(null);setDialog('members');setMenuAnchor(null)}};
  async function saveTab(patch:Partial<SidebarTab>,revision:string) {
    if(!active||!ownerHost)return false;
    const next={...active,...patch};
    const members:TabMember[]=[...(next.organization.assignments??[]).map(a=>({hostId:a.hostId,agentId:a.agentId}))];
    for(const [hostId,organization] of [[ownerHost,next.organization],...Object.entries(next.hosts)] as Array<[string,Organization]>) {
      for(const id of [...organization.groups.flatMap(group=>group.agentIds),...organization.ungroupedOrder])members.push(memberRef(hostId,id));
    }
    return save(updateSidebarTab(state,active.id,{...patch,members:addTabMembers(next,members)}),revision);
  }
  const menu:DropdownItem[]=[
    {id:'enabled',label:'Enable custom tabs',checked:state.enabled,onSelect:()=>{void save({...state,enabled:!state.enabled});setMenuAnchor(null)}},
    {id:'new',label:'New tab…',icon:'plus',disabled:settings.status!=='ready',onSelect:openNew},
    ...(active?[
      {id:'members',label:'Choose conversations…',onSelect:openMembers},
      {id:'rename',label:'Rename tab…',onSelect:()=>{setDraft(active.name);setDialogRevision(settings.status==='ready'?settings.revision:undefined);setDialog('rename');setMenuAnchor(null)}},
      {id:'close',label:'Close tab',onSelect:()=>{void save(closeSidebarTab(state,active.id));setMenuAnchor(null)}},
    ]:[]),
    ...state.tabs.filter(tab=>!tab.open).map((tab,index)=>({id:`reopen-${tab.id}`,label:`Reopen ${tab.name}`,separatorBefore:index===0,onSelect:()=>{void save(reopenSidebarTab(state,tab.id));setMenuAnchor(null)}})),
  ];
  const disabled=saving||settings.status!=='ready';
  return <View style={{flex:1,minWidth:0}}>
    {state.enabled&&<View style={{flexDirection:'row',alignItems:'center',gap:2,paddingHorizontal:8,paddingTop:4,minWidth:0}}>
      {<ScrollView ref={tabScroll} horizontal accessibilityLabel="Custom tabs" showsHorizontalScrollIndicator={false} style={{flex:1,minWidth:0,flexGrow:1}} contentContainerStyle={{alignItems:'center',gap:2}}>
        <FeedbackPressable theme={view.theme} accessibilityRole="tab" accessibilityLabel="Select tab All" accessibilityState={{selected:!active,disabled}} disabled={disabled} onPress={()=>{void save({...state,activeId:'all'})}} style={{minHeight:view.layout.compact?44:30,paddingHorizontal:10,justifyContent:'center',backgroundColor:!active?c.surface2:undefined}}><Text style={{color:!active?c.foreground:c.foregroundMuted,fontSize:12}}>All</Text></FeedbackPressable>
        {state.tabs.filter(tab=>tab.open).map(tab=><View key={tab.id} onLayout={event=>{tabPositions.current[tab.id]=event.nativeEvent.layout.x;if(active?.id===tab.id)tabScroll.current?.scrollTo({x:Math.max(0,event.nativeEvent.layout.x-24),animated:false})}} style={{flexDirection:'row',alignItems:'center',borderRadius:5,backgroundColor:active?.id===tab.id?c.surface2:undefined,maxWidth:160}}>
          <FeedbackPressable theme={view.theme} accessibilityRole="tab" accessibilityLabel={`Select tab ${tab.name}`} accessibilityState={{selected:active?.id===tab.id,disabled}} disabled={disabled} onPress={()=>{void save({...state,activeId:tab.id})}} style={{minHeight:view.layout.compact?44:30,paddingLeft:10,paddingRight:4,justifyContent:'center',flexShrink:1}}><Text numberOfLines={1} style={{color:active?.id===tab.id?c.foreground:c.foregroundMuted,fontSize:12}}>{tab.name}</Text></FeedbackPressable>
          <FeedbackPressable theme={view.theme} accessibilityRole="button" accessibilityLabel={`Close tab ${tab.name}`} disabled={disabled} onPress={()=>{void save(closeSidebarTab(state,tab.id))}} style={{width:view.layout.compact?32:24,minHeight:view.layout.compact?44:30,alignItems:'center',justifyContent:'center'}}><Glyph name="close" size={11} color={c.foregroundMuted}/></FeedbackPressable>
        </View>)}
      </ScrollView>}
      {state.enabled&&<FeedbackPressable theme={view.theme} disabled={disabled} accessibilityRole="button" accessibilityLabel="New tab" onPress={openNew} style={{width:view.layout.compact?36:28,minHeight:view.layout.compact?44:30,justifyContent:'center',alignItems:'center'}}><Glyph name="plus" size={13} color={c.foregroundMuted}/></FeedbackPressable>}
      {active&&<FeedbackPressable theme={view.theme} disabled={disabled} accessibilityRole="button" accessibilityLabel="Choose conversations for tab" onPress={openMembers} style={{width:view.layout.compact?36:28,minHeight:view.layout.compact?44:30,justifyContent:'center',alignItems:'center'}}><Glyph name="conversations" size={13} color={c.foregroundMuted}/></FeedbackPressable>}
      <FeedbackPressable focusRef={menuRef} theme={view.theme} disabled={disabled} accessibilityRole="button" accessibilityLabel="Custom tab options" onPress={()=>menuRef.current?.measureInWindow((x,y,width,height)=>setMenuAnchor({right:x+width,top:y+height+4}))} style={{width:view.layout.compact?36:28,minHeight:view.layout.compact?44:30,justifyContent:'center',alignItems:'center'}}><Glyph name="moreVertical" size={13} color={c.foregroundMuted}/></FeedbackPressable>
    </View>}
    <DropdownMenu anchor={menuAnchor} items={menu} view={view} close={()=>setMenuAnchor(null)} busy={saving} error={error}/>
    {error&&!dialog&&<Text accessibilityRole="alert" style={{color:c.statusDanger,fontSize:11,padding:8}}>{error}</Text>}
    {settings.status==='ready'&&(!active||ownerHost)?children(active?{tab:active,revision:settings.revision,saving,error,saveOrganization:(values,revision,hosts)=>saveTab({organization:values,...(hosts?{hosts}:{})},revision),saveHosts:(values,revision)=>saveTab({hosts:values.hosts},revision),openMembers}:undefined,{enabled:state.enabled,saving,items:menu}):<Text style={{color:c.foregroundMuted,padding:12}}>{settings.status==='error'||settings.status==='invalid'?settings.error:hostError||'Loading tabs…'}</Text>}
    <Modal transparent visible={dialog!==null} animationType="fade" onRequestClose={resetDialog}>
      <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:16,backgroundColor:'rgba(0,0,0,0.35)'}} {...{onKeyDown:(event:{key:string;stopPropagation():void})=>{if(event.key==='Escape'){event.stopPropagation();resetDialog()}}}}>
      <View role="dialog" accessibilityLabel="Tab editor" accessibilityViewIsModal style={{width:'100%',maxWidth:420,maxHeight:'90%',borderRadius:10,backgroundColor:c.surface0,borderWidth:1,borderColor:c.border,padding:16}}>
      <Text style={{color:c.foreground,fontSize:15,fontWeight:'600',marginBottom:16}}>{dialog==='members'?'Choose conversations':dialog==='rename'?'Rename tab':'New tab'}</Text>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12}}>
        {dialog==='members'?<>
          <Text style={{color:c.foregroundMuted,fontSize:12}}>Choose existing conversations for this tab. They stay on their original servers.</Text>
          <TextInput accessibilityLabel="Search tab conversations" value={memberSearch} onChangeText={setMemberSearch} placeholder="Search conversations…" placeholderTextColor={c.foregroundMuted} style={{color:c.foreground,minHeight:40,padding:8,backgroundColor:c.surface1,borderRadius:5}}/>
          <View style={{maxHeight:300}}><ScrollView keyboardShouldPersistTaps="handled">{agents.map(reference=><MemberChoice key={reference.key} reference={reference} view={view} disabled={saving} checked={memberDraft.some(member=>member.hostId===reference.hostId&&member.agentId===reference.id)} toggle={()=>setMemberDraft(previous=>previous.some(member=>member.hostId===reference.hostId&&member.agentId===reference.id)?previous.filter(member=>member.hostId!==reference.hostId||member.agentId!==reference.id):[...previous,{hostId:reference.hostId,agentId:reference.id}])}/>)}</ScrollView></View>
        </>:<TextInput autoFocus accessibilityLabel="Tab name" value={draft} onChangeText={value=>{setDraft(value);setError(null)}} maxLength={40} editable={!saving} placeholder="Tab name…" placeholderTextColor={c.foregroundMuted} onSubmitEditing={()=>{if(draft.trim())void submit()}} style={{color:c.foreground,minHeight:40,padding:8,backgroundColor:c.surface1,borderRadius:5}}/>}
        {error&&<Text accessibilityRole="alert" style={{color:c.statusDanger,fontSize:12}}>{error}</Text>}
        <View style={{flexDirection:'row',justifyContent:'flex-end',gap:8}}>
          <FeedbackPressable theme={view.theme} disabled={saving} accessibilityLabel="Cancel tab editor" onPress={resetDialog} style={{padding:10}}><Text style={{color:c.foregroundMuted}}>Cancel</Text></FeedbackPressable>
          <FeedbackPressable theme={view.theme} disabled={saving||(dialog!=='members'&&!draft.trim())} accessibilityLabel="Save tab" accessibilityState={{busy:saving}} onPress={()=>{void submit()}} style={{padding:10,backgroundColor:c.surface2,borderRadius:5}}><Text style={{color:c.foreground}}>{saving?'Saving…':dialog==='new'?'Create':'Save'}</Text></FeedbackPressable>
        </View>
      </ScrollView></View></View>
    </Modal>
  </View>;
  async function submit(){
    if(dialog==='members'&&active&&ownerHost){if(await save(updateSidebarTab(state,active.id,selectTabMembers(active,memberDraft,ownerHost)),dialogRevision))setDialog(null);}
    else if(dialog==='rename'&&active&&draft.trim()){if(await save(updateSidebarTab(state,active.id,{name:draft.trim()}),dialogRevision))setDialog(null);}
    else if(dialog==='new'&&draft.trim()){if(await save(createSidebarTab(state,`tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,draft),dialogRevision))setDialog(null);}
  }
}
