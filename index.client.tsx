import type { PluginClientContext } from '@getpaseo/plugin/client';
import { FolderSidebar } from './client/sidebar';
export default function contribute(client: PluginClientContext) {
  return client.addSidebarView({ id: 'folders', title: '对话文件夹', description: '在左侧用可折叠文件夹整理对话', Component: FolderSidebar });
}
