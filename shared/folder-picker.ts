import { containsMember, memberRef, type Group } from './model';

export interface PickerMember { hostId: string; agentId: string }
export interface PickerBranch {
  id: string;
  title: string;
  icon: string;
  projectKey?: string;
  members: PickerMember[];
  children: PickerBranch[];
}
export interface PickerProject { key: string; title: string; hostId: string; workspaceKeys: readonly string[] }
export interface PickerAgent { hostId: string; id: string; workspace: { key: string } }

/** Mirror the active sidebar's organization; source identities never depend on display names. */
export function currentPickerTree({ mode, hosts, targetHost, groupsForHost, projects, agents }: {
  mode: 'manual' | 'server' | 'project' | 'server-project';
  hosts: readonly { serverId: string; label: string }[];
  targetHost: string;
  groupsForHost(hostId: string): readonly Group[];
  projects: readonly PickerProject[];
  agents: readonly PickerAgent[];
}): PickerBranch[] {
  const allGroups = hosts.flatMap(host => groupsForHost(host.serverId).map(group => ({ hostId: host.serverId, group })));
  const assigned = (agent: PickerAgent) => allGroups.some(({ hostId, group }) => containsMember(group.agentIds, hostId, agent.hostId, agent.id));
  const members = (items: readonly PickerAgent[]) => items.map(agent => ({ hostId: agent.hostId, agentId: agent.id }));
  const projectMembers = (project: PickerProject) => agents.filter(agent => project.workspaceKeys.includes(agent.workspace.key) && !assigned(agent));
  const folder = (hostId: string, group: Group): PickerBranch => ({
    id: JSON.stringify(['folder', hostId, group.id]), title: group.name, icon: group.projectKey ? 'project' : 'folder', projectKey: group.projectKey,
    members: group.agentIds.flatMap(id => {
      const ref = memberRef(hostId, id);
      return agents.some(agent => agent.hostId === ref.hostId && agent.id === ref.agentId) ? [ref] : [];
    }),
    children: groupsForHost(hostId).filter(child => child.parentId === group.id).map(child => folder(hostId, child)),
  });
  const nativeProjects = (hostId?: string): PickerBranch[] => projects.filter(project => (!hostId || project.hostId === hostId) && !groupsForHost(project.hostId).some(group => group.projectKey === project.key)).map(project => ({
    id: JSON.stringify(['project', project.key]), title: project.title, icon: 'project', projectKey: project.key,
    members: members(projectMembers(project)), children: [],
  }));
  if (mode === 'manual') return [
    ...groupsForHost(targetHost).filter(group => !group.parentId).map(group => folder(targetHost, group)),
    { id: JSON.stringify(['unfiled', targetHost]), title: 'Unfiled', icon: 'conversations', members: members(agents.filter(agent => agent.hostId === targetHost && !assigned(agent))), children: [] },
  ];
  const roots = allGroups.filter(({ group }) => !group.parentId && (group.topLevel || mode === 'project')).map(({ hostId, group }) => folder(hostId, group));
  if (mode === 'project') return [...nativeProjects(), ...roots];
  return [
    ...hosts.map(host => ({
      id: JSON.stringify(['host', host.serverId]), title: host.label, icon: 'server',
      members: mode === 'server' ? members(agents.filter(agent => agent.hostId === host.serverId && !assigned(agent))) : [],
      children: [...(mode === 'server-project' ? nativeProjects(host.serverId) : []), ...groupsForHost(host.serverId).filter(group => !group.parentId && !group.topLevel).map(group => folder(host.serverId, group))],
    })),
    ...roots,
  ];
}
