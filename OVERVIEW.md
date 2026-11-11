# Conversation folders

Organize existing Paseo conversations into collapsible folders, or group them by server, project, or server and project. A folder can contain conversations from several servers; each conversation stays on its original server.

## Setup

Requires Paseo >=0.16.0-beta.1 and <0.17.0 on each client and the daemon. In Settings → Sidebar → Sidebar view, select Conversation folders. No external account or token is required. Permanent deletion requires the official Paseo CLI already installed on the plugin's daemon host.

## Organizing conversations

The heading's + creates a root folder alongside servers. A server's More menu creates a folder beneath that server. Folder names are display labels, not filesystem paths. Folders support one level of subfolders; deleting a folder preserves its conversations and promotes its children.

On desktop/web, drag conversations onto folders or automatic project branches, including their empty content areas. These assignments change sidebar organization only, not the conversation's actual project or files. Drag before another conversation to enable Custom order. Dropping onto the original server or its Unfiled section removes the assignment. Source server names remain visible inside folders.

New folders appear at the end of their sibling list. Collapse all closes the tree; clicking Restore expansion returns each branch to its previous open or closed state.

## Custom tabs

The top tab bar has a + button for creating named tabs. Choose existing conversations with the conversation icon or Choose conversations… in the tab menu. Each tab has its own folders and assignments; the same conversation can appear in multiple tabs without being copied or moved. All keeps the original sidebar organization.

Click × to close a tab. Its contents are retained, and the tab menu or Filter → Custom tabs offers Reopen. The menu also supports renaming. Filter → Custom tabs → Enable custom tabs turns the entire bar off or back on without discarding saved tabs. New and reopened tabs scroll into view. These custom sidebar tabs are separate from server filters and central conversation tabs.

## Display and filtering

Filter opens a dropdown containing search, grouping, sorting, title wrapping, display options, server/project/label filters, status filters, and background workspace visibility. Server tabs filter the sidebar and support name, initial, or count styles, including with one server. They do not control central conversation tabs.

Activity time appears on the right of desktop conversation rows. Hovering reveals small Archive and More buttons within the same row background. A delayed information card shows the full title, server, and workspace path. Compact layouts keep action buttons available.

Running conversations and their parent branches use the selected loading effect: Spinner, Orbit, Pulse, Three dots, or Wave bars. Loading colors default to blue, with purple, cyan, orange, and pink choices. Read, resting conversations display green; unread updates use the theme accent. The public API does not distinguish a new idle conversation from a completed idle conversation. Collapsed branches with updates show a green corner badge. Motion respects the client's reduced-motion preference.

In project grouping modes, the project More button opens an appearance dialog for its display name, icon, color, and optional image. Desktop/web accepts PNG, JPEG, or WebP up to 128 KB. These settings do not rename projects or directories. Restore default removes the override.

## Conversation and workspace actions

The conversation More menu, right-click, or long-press provides open workspace, copy path or branch, rename workspace, pin, labels, archive conversation, archive workspace, and permanent conversation deletion where supported. Archive and deletion require confirmation. Workspace rename, pin, and labels affect the whole workspace. Archiving a workspace affects all its conversations; archiving one conversation leaves others active.

Permanent deletion uses the official Paseo CLI on the plugin host and removes conversation history after confirmation. It does not delete workspace files. Remote conversations must be permanently deleted using their source host's native controls. The plugin does not install software to provide this operation. The current public plugin API does not expose manual mark-as-unread or open-in-file-manager actions; Open workspace provides access to native workspace controls.

## Data and limitations

The plugin reads conversation titles, status, activity times, workspace paths, branches, labels, and configured server identities from Paseo. Custom tabs, their conversation selections, folder assignments, display preferences, and appearance overrides are stored in the installation's plugin settings. Cross-server assignments retain server-qualified identities. Selected images are stored in those settings. The plugin does not send prompts or tool results to agent providers or an external service. Explicit menu actions use the original server through Paseo; copy actions use the client clipboard.

Desktop/web drag is supported; native touch drag is not implemented. Narrow browser layouts have been checked, but physical-phone acceptance, all themes, simultaneous two-server drag, and image upload end to end remain unverified. Regression tests cover linked-project visibility in Custom folders mode and moving previously assigned conversations with the manual controls.
