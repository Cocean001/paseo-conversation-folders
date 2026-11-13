import { deleteConversation, renameConversation } from './shared/conversation-actions';
import { deleteConfirmedConversation, renameSourceConversation } from './server/conversation-actions';
import type { PluginServerContext } from '@getpaseo/plugin/server';
import { organization, hostOrganizations, displayPreferences, projectAppearance, sidebarTabs } from './shared/settings';
import { hostContext } from './shared/host-context';
export default function contribute(server: PluginServerContext) {
  server.handle(deleteConversation, deleteConfirmedConversation);
  server.handle(renameConversation, renameSourceConversation);
  server.registerSettings(sidebarTabs);
  server.registerSettings(organization);
  server.registerSettings(projectAppearance);
  server.registerSettings(displayPreferences);
  server.registerSettings(hostOrganizations);
  server.handle(hostContext, async (_, { paseo }) => ({ hostId: (await paseo.hosts.list()).self.serverId }));
  return () => {};
}
