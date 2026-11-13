# Functional acceptance gate

Unit tests and typechecking are necessary, not user-interface acceptance. Run the following against the installed candidate in an isolated daemon with disposable conversations. Never archive, delete, edit settings, or simulate storage failures against a user's main daemon.

For editable features, verify the visible result, reopen the editor, reload the app, and check persisted state. A successful request or a closed dialog alone is not a pass. Use real pointer input for core row actions; a direct DOM click can bypass an overlay or an invisible action.

## Conversation and workspace actions

- Open a conversation and its native workspace; check the source host.
- Rename a conversation; verify the sidebar and full reload, then restore it.
- Rename a workspace; verify it independently of conversation/project names, then restore it.
- Cancel edits, submit blank names with Enter, and check invalid/failed saves preserve drafts.
- Pin/unpin a workspace; add and remove a workspace label.
- Copy a path and a branch; verify unavailable actions are disabled.
- Cancel archive/delete confirmation without changing the conversation.
- Actually archive and permanently delete separate disposable conversations; inspect persisted daemon state.
- Archive a disposable workspace containing multiple conversations; inspect all of its members.
- Verify remote-source rename and permanent delete cannot target the plugin's own host accidentally.

## Organization and custom tabs

- Create/rename/cancel a top-level folder and a host-scoped folder.
- Create a child; reject a third level; delete its parent without deleting conversations.
- Preserve promoted children's root-level versus host-level placement and omit absent JSON fields.
- Drag conversations onto a header and empty content; reorder; cancel a drag; reload and inspect order.
- Drag the customized project row (including a blue star icon) into a folder and back beneath its host, reorder at root, then reload. Verify one project row, unchanged icon/name, and both native and explicitly assigned conversations; repeat with no pre-existing project organization record.
- Drag a folder onto another folder’s center to nest, onto its edges to reorder, onto the sidebar header to promote, and onto its own host header to move beneath that host. Reject cycles and a third level; preserve conversations and assignments.
- Switch among all grouping modes with a moved project: exactly one copy of each native and explicitly assigned conversation, unchanged project appearance, and no writes to native membership.
- Drop a folder into empty content and an unsaved project; reorder at an unsaved project edge. Nest a child inside a project and check reload/manual mode.
- Reorder conversations inside an unsaved project; persist the project destination and visible order after reload.
- Move a foreign conversation with manual controls and preserve its source host; Move up stays within siblings.
- Collapse all and restore the exact previous nested expansion states.
- Create/rename/cancel a custom tab; choose and deselect members.
- Check independent folder organization against All and another tab.
- Close/reopen and disable/re-enable tabs without losing content; reload.
- Use qualified host+conversation identities for mixed-host members.

## Display and filters

- Search, clear search, and check all status filters.
- Check sorting directions and custom order against actual row order.
- Combine project, label, host, and background-workspace filters; clear them.
- Check title style, server labels/counts, and server-tab visibility/styles.
- Save name/icon/color; reject invalid colors; cancel and restore defaults.
- Upload PNG/JPEG/WebP, reject invalid or oversized files, reload, remove the image, and reset.
- Select each loading effect and color; verify saved selection and animated previews.
- Inspect completed/unread/error/permission states and collapsed update indicators.

## Failure and layout gates

- A second independent live client changes settings during an open editor: reject stale saves and retain the draft, preserving the other client's data.
- A real write failure retains folder, appearance, and tab drafts; restore writable storage and retry. Restore original directory permissions in `finally`.
- Duplicate submits perform one operation; busy editors cannot close or submit again.
- Verify desktop, narrow drawer, and short-window dialog bounds and reachable Save/Cancel.
- Check keyboard Escape/context-menu handling and reduced-motion behavior.
- Record screenshots locally only; never ship private conversations, paths, host names, or test artifacts.

## Evidence boundaries

Record each item as passed, failed, or not exercised. Separate unit/component tests, live browser interaction, persisted daemon state, real multi-host connectivity, theme review, and physical-device acceptance. Do not label native touch drag, all themes, real concurrent two-server drag, or physical mobile behavior as passed based on a resized desktop browser. Public API limitations must be documented, not hidden by unsafe fallbacks.

Do not publish or resume registry submission merely because this checklist passes. Release media and publication require their separate review gate.
