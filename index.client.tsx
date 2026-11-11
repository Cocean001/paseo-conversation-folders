import type { PluginClientContext } from '@getpaseo/plugin/client';
import { SidebarWithTabs } from './client/sidebar';
export default function contribute(client: PluginClientContext) {
  return client.addSidebarView({ id: 'folders', title: 'Conversation folders', description: 'Organize conversations in collapsible folders', Component: SidebarWithTabs });
}
