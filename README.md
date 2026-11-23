# Conversation folders for Paseo

[简体中文](README.zh-CN.md)

Organize existing Paseo conversations with folders, separate tabs, and drag and drop.

## Install

Requires Paseo `>=0.16.0-beta.1 <0.18.0` on the daemon and clients.

```sh
paseo plugin install https://github.com/Cocean001/paseo-conversation-folders
```

Select **Conversation folders** in **Settings → Sidebar → Sidebar view**. Paseo stores this choice per device, so select it in each desktop app, browser, and phone you use.

## Use

- The search box at the top filters conversations by title. **In progress** lists what is running, waiting for your approval, or finished but unread, across all projects; fold it from its heading.
- Subtasks a conversation starts are folded under it behind a count. A subtask appears in **In progress** only when it asks for permission, and the count turns amber when a subtask needs approval or failed. Search and status filters list subtasks directly.
- Titles use two lines on desktop and one on phones; change it per device in **View options → Titles**.
- In the project view each project shows its latest ten conversations with **Show more** for the rest, and uses the same colored initial tile as Paseo’s own sidebar. Hover a project and press **+** to start a new conversation in it. When sorted by activity or creation time, a project's list is split into Today, Yesterday, Previous 7 days, Previous 30 days, and Older.
- Create folders with the **New folder** button or a server’s **More → New folder…**. Folders support one level of children; deleting a folder keeps its conversations.
- Drag conversations, folders, and projects to move or reorder them. On a phone, long-press a row and move your finger; the list scrolls when you reach its edge. Lists hold their order while you drag, even when running conversations update. Dropping a project on another project, or on that project's open list, reorders it and never nests it. Folder **+** lets you select conversations from **Current layout** or **Original sources** (server → workspace).
- Create separate tabs from **View options → Custom tabs → New tab…**; the tab strip appears once a tab exists. Each tab has its own folders. Closing a tab keeps its contents; reopen it from the same menu.
- Use **View options** for grouping, sorting, status, and display settings. **Collapse all → Restore expansion** restores the previous branch states.
- A project’s **More** menu starts a new conversation or changes its display name, icon, emoji, color, or image. Images support PNG, JPEG, and WebP up to 128 KB on desktop and web.
- Right-click a conversation, use **More**, or long-press on a phone and release without moving for rename, pin, labels, copy, archive, and deletion where available. Archive and deletion require confirmation; workspace actions affect the whole workspace.
- The interface follows Paseo’s language setting. English and Simplified Chinese are included.

Folders, order, project appearance, and display settings are saved in Paseo’s plugin settings, shared by every connected client, and update live. Folded branches, **Show more**, title lines, and the selected tab are remembered on each device. Conversations keep their original server, workspace, and files. The plugin does not upload this information to an external service.

## Limits

Conversation rename and permanent deletion run the Paseo CLI on the plugin host; on Windows the plugin runs the CLI bundled with the Paseo desktop app, without a shell. Use the source server’s native controls for remote conversations. Permanent deletion removes conversation history.

Background helper agents, which Paseo hides from its own lists, are not listed. Project tiles match Paseo’s colors for directory projects; a Git project with a remote can get a different color because plugins cannot read the remote.

Touch drag was checked in a phone-sized browser with simulated touch, not yet on a physical phone. In the manual folder view, reorder folders on a phone with **Move up**. Concurrent use of two real servers has not completed acceptance checks. Manual mark-as-unread and open-in-file-manager are unavailable through the current API.
