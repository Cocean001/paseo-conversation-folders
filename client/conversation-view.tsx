import { createContext, useContext } from 'react';
import type { Group } from '../shared/model';
import { defaultConversationOptions, type ConversationOptions } from '../shared/conversations';
export const ConversationViewContext = createContext<{ options: ConversationOptions; foldersForHost(hostId: string): Group[]; unfiledOrder(hostId: string): readonly string[] }>({ options: defaultConversationOptions, foldersForHost: () => [], unfiledOrder: () => [] });
export const useConversationView = () => useContext(ConversationViewContext);
