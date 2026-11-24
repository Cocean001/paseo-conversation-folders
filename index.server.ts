import { deleteConversation, renameConversation } from './shared/conversation-actions';
import { deleteConfirmedConversation, renameSourceConversation } from './server/conversation-actions';
import type { PluginServerContext } from '@getpaseo/plugin/server';
import { organization, hostOrganizations, displayPreferences, projectAppearance, sidebarTabs, pinnedConversations } from './shared/settings';
import { hostContext, transcriptSearch } from './shared/host-context';
import { pluginEnabled } from './server/plugins';
export default function contribute(server: PluginServerContext) {
  server.handle(deleteConversation, deleteConfirmedConversation);
  server.handle(renameConversation, renameSourceConversation);
  server.registerSettings(sidebarTabs);
  server.registerSettings(organization);
  server.registerSettings(projectAppearance);
  server.registerSettings(displayPreferences);
  server.registerSettings(hostOrganizations);
  server.registerSettings(pinnedConversations);
  server.handle(hostContext, async (_, { paseo }) => ({ hostId: (await paseo.hosts.list()).self.serverId }));
  server.handle(transcriptSearch, () => ({ enabled: pluginEnabled('transcript-search') }));
  return () => {};
}
