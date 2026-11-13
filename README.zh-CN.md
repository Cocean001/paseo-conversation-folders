# Paseo 对话文件夹

[English](README.md)

用文件夹、独立标签页和拖动操作整理已有的 Paseo 对话。

## 安装

守护进程和客户端需要 Paseo `>=0.16.0-beta.1 <0.17.0`。

```sh
paseo plugin install https://github.com/Cocean001/paseo-conversation-folders
```

在 **Settings → Sidebar → Sidebar view** 中选择 **Conversation folders**。

## 使用

- 标题旁的 **+** 或服务器的 **More → New folder…** 可新建文件夹。支持一层子文件夹，删除文件夹会保留对话。
- 拖动对话、文件夹或项目即可移动和排序。文件夹旁的 **+** 可从 **Current layout（当前分类）** 或 **Original sources（服务器 → 工作区）** 选择对话，切换视图会保留勾选。
- 顶部标签栏的 **+** 可新建独立标签页，各自保存文件夹。关闭后内容仍保留，可从 **Filter → Custom tabs** 重新打开。
- **Filter** 集中提供搜索、分组、排序、状态和显示设置。**Collapse all → Restore expansion** 可恢复之前的展开状态。
- 项目的 **More** 可修改显示名称、图标、emoji、颜色或图片。桌面和网页支持最大 128 KB 的 PNG、JPEG、WebP。
- 对话右键或 **More** 菜单提供重命名、置顶、标签、复制、归档和可用时的删除。归档与删除需要确认，工作区操作会影响整个工作区。

分类保存在 Paseo 插件设置中，对话保留原服务器、工作区和文件。插件不会把这些信息上传到外部服务。

## 限制

对话重命名和永久删除需要插件所在主机已安装官方 Paseo CLI；远程对话请使用来源服务器的原生控件。永久删除会移除对话历史。

支持桌面和网页拖动，尚未实现原生触摸拖动。手机实机、全部主题和两台真实服务器同时使用尚未完成验收；当前 API 不支持手动标为未读和打开文件管理器。
