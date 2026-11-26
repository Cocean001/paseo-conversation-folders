// Paseo's own project tile palette and hash, so a project keeps the color it has in Paseo's default sidebar.
const palette = ['#7a6aa8', '#3d7ea6', '#388068', '#a4673a', '#b05c80', '#6a70b8', '#368080', '#b06260', '#8f7838', '#5179b0'];
export function identityColor(key: string): string {
  let hash = 0;
  for (const character of key) hash = (31 * hash + character.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
/** shortcut: Paseo keys git projects with a remote by that remote, which plugins cannot read; those fall back to the root path key. */
export function projectTile(hostId: string, rootPath: string, name: string) {
  return { color: identityColor(`host:${hostId}:${rootPath.toLowerCase()}`), letter: name.trim().charAt(0).toUpperCase() || '?' };
}
