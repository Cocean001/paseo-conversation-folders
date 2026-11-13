# Conversation folders for Paseo

Organize existing Paseo conversations with folders, separate tabs, and drag and drop.

## Setup

Requires Paseo `>=0.16.0-beta.1 <0.17.0` on the daemon and clients.


Select **Conversation folders** in **Settings → Sidebar → Sidebar view**.

## Use

- Create folders with the heading’s **+** or a server’s **More → New folder…**. Folders support one level of children; deleting a folder keeps its conversations.
- Drag conversations, folders, and projects to move or reorder them. Folder **+** lets you select conversations from **Current layout** or **Original sources** (server → workspace). Switching views keeps your selection.
- Create separate tabs with **+** in the tab bar. Each has its own folders. Closing a tab keeps its contents; reopen it through **Filter → Custom tabs**.
- Use **Filter** for search, grouping, sorting, status, and display settings. **Collapse all → Restore expansion** restores the previous branch states.
- Open a project’s **More** menu to change its display name, icon, emoji, color, or image. Images support PNG, JPEG, and WebP up to 128 KB on desktop and web.
- Right-click a conversation or use **More** for rename, pin, labels, copy, archive, and deletion where available. Archive and deletion require confirmation; workspace actions affect the whole workspace.

Organization is saved in Paseo’s plugin settings. Conversations keep their original server, workspace, and files. The plugin does not upload this information to an external service.

## Limits

Conversation rename and permanent deletion require the official Paseo CLI on the plugin host. Use the source server’s native controls for remote conversations. Permanent deletion removes conversation history.

Drag works on desktop and web; native touch drag is not implemented. Physical mobile devices, all themes, and concurrent use of two real servers have not completed acceptance checks. Manual mark-as-unread and open-in-file-manager are unavailable through the current API.
