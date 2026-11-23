import { defineTranslations, useTranslation } from '@getpaseo/plugin/client';

export const messages = defineTranslations({ resources: {
  en: { viewTitle: 'Conversation folders', viewDescription: 'Projects and folders with their conversations listed below' },
  'zh-CN': { viewTitle: '对话文件夹', viewDescription: '按项目和文件夹竖排列出对话' },
} });

// English source text is the key, so untranslated strings fall back to English unchanged.
const zh: Record<string, string> = {
  'Untitled conversation': '未命名对话', 'Untitled workspace': '未命名工作区', 'Search conversations…': '搜索对话…',
  'Loading…': '正在加载…', 'Loading folders…': '正在加载文件夹…', 'Saving…': '正在保存…',
  'New folder': '新建文件夹', 'New folder…': '新建文件夹…', 'New subfolder': '新建子文件夹', 'New subfolder…': '新建子文件夹…',
  'Cancel': '取消', 'Close': '关闭', 'Create': '创建', 'Save': '保存', 'Done': '完成', 'Remove': '移除',
  'Collapse all': '全部折叠', 'Restore expansion': '恢复展开', 'View options': '视图与筛选', 'Clear filters': '清除筛选',
  'Folder name…': '文件夹名称…', 'Subfolder name…': '子文件夹名称…', 'Unfiled': '未分组',
  'Add existing conversations to this tab.': '把已有对话加入这个标签页。', 'Choose conversations…': '选择对话…',
  'Choose a folder for the selected conversation': '为选中的对话选择文件夹', 'No matching conversations': '没有匹配的对话',
  'Drop conversations here': '把对话拖到这里', 'Rename': '重命名', 'Rename…': '重命名…', 'Move up': '上移', 'Delete folder': '删除文件夹',
  'Add conversations to this folder': '向此文件夹添加对话', 'Empty': '暂无对话', 'No projects': '没有项目', 'No connected servers': '没有已连接的服务器',
  'Group by': '分组', 'Custom folders': '自定义文件夹', 'Server': '服务器', 'Project': '项目', 'Server / Project': '服务器 / 项目',
  'Sort by': '排序', 'Last activity': '最近活动', 'Creation time': '创建时间', 'Title': '标题', 'Custom order': '自定义顺序',
  'Ascending': '升序', 'Descending': '降序', 'Titles': '标题显示', 'Single line': '单行', 'Multiline': '多行', 'Display': '显示',
  'Server labels': '服务器名称', 'Conversation counts': '对话数量', 'Loading color': '运行动画颜色', 'Loading · {0}': '运行动画 · {0}',
  'Spinner': '转圈', 'Orbit': '轨道', 'Pulse': '脉冲', 'Three dots': '三个点', 'Wave bars': '波浪条',
  'Host': '主机', 'All hosts': '全部主机', 'All projects': '全部项目', '{0} selected': '已选 {0} 个', 'Labels': '标签', 'All labels': '全部标签',
  'Show background workspaces': '显示后台工作区', 'Status': '状态', 'All': '全部', 'All conversations': '全部对话',
  'Running': '运行中', 'Needs attention': '需要处理', 'Errors': '出错', 'Custom tabs': '自定义标签页', 'On': '开', 'Off': '关',
  'Server tabs': '服务器标签页', 'Show server tabs': '显示服务器标签页', 'Name': '名称', 'Initial': '首字母', 'Count': '数量', 'Hidden': '隐藏',
  'Organize conversations…': '整理对话…', 'More actions': '更多操作', 'Recent': '最近', 'Projects': '项目', 'Folders': '文件夹', 'Servers': '服务器',
  'Enable custom tabs': '启用自定义标签页', 'New tab…': '新建标签页…', 'Rename tab…': '重命名标签页…', 'Close tab': '关闭标签页', 'Reopen {0}': '重新打开 {0}',
  'Choose conversations': '选择对话', 'Rename tab': '重命名标签页', 'New tab': '新建标签页', 'Tab name…': '标签页名称…',
  'Choose existing conversations for this tab. They stay on their original servers.': '为这个标签页选择已有对话，对话仍留在原来的服务器上。',
  'Name, icon & color…': '名称、图标和颜色…', 'Collapse': '折叠', 'Expand': '展开', 'New conversation': '新建对话',
  'Show {0} more': '显示更多（{0}）', 'Show less': '收起', 'Project appearance': '项目外观', 'Display name': '显示名称', 'Icon': '图标',
  'Choose icon': '选择图标', 'Search icons…': '搜索图标…', 'Custom emoji': '自定义表情', 'Icon color': '图标颜色', 'Upload image': '上传图片',
  'Restore default': '恢复默认', 'Offline': '离线', 'Connecting…': '正在连接…', 'Connection error': '连接出错',
  'Open workspace': '打开工作区', 'Copy path': '复制路径', 'Copy branch name': '复制分支名', 'Rename conversation…': '重命名对话…',
  'Rename workspace…': '重命名工作区…', 'Unpin workspace': '取消置顶工作区', 'Pin workspace': '置顶工作区', 'Labels…': '标签…',
  'Archive conversation…': '归档对话…', 'Delete conversation…': '删除对话…', 'Archive workspace…': '归档工作区…',
  'Rename conversation': '重命名对话', 'Rename workspace': '重命名工作区', 'Workspace labels': '工作区标签', 'Archive workspace?': '归档工作区？',
  'Delete conversation permanently?': '永久删除对话？', 'Archive conversation?': '归档对话？', 'Conversation name': '对话名称',
  'Default workspace name': '默认工作区名称', 'Label name': '标签名称', 'Workspace': '工作区',
  'Permanently delete “{0}” and its conversation history? Running work will stop. This cannot be undone. Workspace files and other conversations stay unchanged.': '永久删除“{0}”及其对话记录？正在运行的任务会停止，删除后无法恢复。工作区文件和其他对话不受影响。',
  'Archive “{0}” and all its conversations? Running work will stop. Files stay on disk.': '归档“{0}”及其中所有对话？正在运行的任务会停止，文件仍保留在磁盘上。',
  'Archive “{0}”? Running work will stop. Other conversations in this workspace stay active.': '归档“{0}”？正在运行的任务会停止，这个工作区里的其他对话不受影响。',
  'Changes the workspace name. Conversation and project names stay the same.': '只改工作区名称，对话和项目名称不变。',
  'Labels apply to the workspace and all its conversations.': '标签作用于整个工作区及其中所有对话。',
  'Delete permanently': '永久删除', 'Archive': '归档', 'Add label': '添加标签',
  'Add conversations': '添加对话', 'Choose conversations for “{0}”.': '为“{0}”选择对话。', 'Current layout': '当前布局', 'Original sources': '原始来源',
  'Move from your sidebar’s folders and projects.': '从侧栏现有的文件夹和项目中挑选。', 'Browse conversations by server and workspace.': '按服务器和工作区浏览对话。',
  'Select all': '全选', 'Deselect all': '取消全选', 'No conversations to add': '没有可添加的对话',
  'No conversations in the current layout. Browse Original sources.': '当前布局里没有对话，请到“原始来源”里找。',
  '{0} workspaces': '{0} 个工作区', 'No workspaces on this server': '这台服务器上没有工作区', 'Add {0} conversations': '添加 {0} 个对话', 'Adding conversations…': '正在添加…',
};

let chinese = false;
/** Call at the view root. shortcut: one app language per client bundle; rows read it through t(). */
export function useAppLanguage() { chinese = useTranslation(messages).locale.toLowerCase().startsWith('zh'); }
export function t(text: string, ...args: Array<string | number>) {
  return (chinese ? zh[text] ?? text : text).replace(/\{(\d)\}/g, (_, index) => String(args[Number(index)] ?? ''));
}
const units: Record<string, string> = { m: '分钟', h: '小时', d: '天', w: '周', y: '年' };
/** Localizes activityTime() output: now, 5m, 3h, 2d, 1w, 1y. */
export function timeLabel(text: string) {
  if (!chinese) return text;
  return text === 'now' ? '刚刚' : text.replace(/^(\d+)([mhdwy])$/, (_, count, unit) => count + units[unit]);
}
