import type { PluginClientContext } from '@getpaseo/plugin/client';
import { SidebarWithTabs } from './client/sidebar';
import { messages } from './client/i18n';
export default function contribute(client: PluginClientContext) {
  return client.addSidebarView({ id: 'folders', title: messages.message('viewTitle'), description: messages.message('viewDescription'), Component: SidebarWithTabs });
}
