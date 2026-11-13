import { createContext, useContext } from 'react';
import type { Group } from '../shared/model';
import { defaultConversationOptions, type ConversationOptions } from '../shared/conversations';
export const ConversationViewContext = createContext<{ options: ConversationOptions; pickerTree?: readonly import('../shared/folder-picker').PickerBranch[]; revision?: string; addConversations?(sources: readonly import('@getpaseo/plugin/client').AgentRef[], destination: import('./drag-and-drop').ConversationDestination, revision?: string): Promise<boolean>; chooseDestination?(destination: import('./drag-and-drop').ConversationDestination): void; foldersForHost(hostId: string): Group[]; unfiledOrder(hostId: string): readonly string[] }>({ options: defaultConversationOptions, foldersForHost: () => [], unfiledOrder: () => [] });
export const useConversationView = () => useContext(ConversationViewContext);
