import type { ReactNode } from 'react';
import { Modal, ScrollView, Text, View, Pressable } from 'react-native';
import type { PluginSidebarViewProps } from '@getpaseo/plugin/client';

/** Keep the editor inside the sidebar's owning view on desktop and compact drawers. */
export function ActionDialog({ open, title, close, busy, view, children }: {open:boolean;title:string;close():void;busy:boolean;view:PluginSidebarViewProps;children:ReactNode}) {
  const c=view.theme.colors;
  return <Modal transparent visible={open} animationType="fade" onRequestClose={()=>{if(!busy)close()}}>
    <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:16,backgroundColor:'rgba(0,0,0,0.35)'}} {...{onKeyDown:(event:{key:string;stopPropagation():void})=>{if(event.key==='Escape'){event.stopPropagation();if(!busy)close()}}}}>
      <Pressable accessibilityLabel={`Dismiss ${title}`} disabled={busy} onPress={close} style={{position:"absolute",top:0,bottom:0,left:0,right:0}}/>
      <View accessibilityRole="none" role="dialog" accessibilityLabel={title} accessibilityViewIsModal style={{width:'100%',maxWidth:420,maxHeight:'90%',borderRadius:10,backgroundColor:c.surface0,borderWidth:1,borderColor:c.border,padding:16}}>
        <Text style={{color:c.foreground,fontSize:15,fontWeight:'600',marginBottom:16}}>{title}</Text>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12}}>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}
