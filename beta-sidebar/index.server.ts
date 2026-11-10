import type { PluginServerContext } from '@getpaseo/plugin/server';
import { organization, hostOrganizations } from './shared/settings';
import { hostContext } from './shared/host-context';
export default function contribute(server: PluginServerContext) {
  server.registerSettings(organization);
  server.registerSettings(hostOrganizations);
  server.handle(hostContext, async (_, { paseo }) => ({ hostId: (await paseo.hosts.list()).self.serverId }));
  return () => {};
}
