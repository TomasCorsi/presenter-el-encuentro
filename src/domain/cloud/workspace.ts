export type WorkspaceRole = "owner" | "operator";

export interface CloudProfile {
  id: string;
  displayName: string;
  personalWorkspaceId: string;
}

export interface CloudWorkspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudWorkspaceMembership {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface PersonalWorkspaceBootstrap {
  profile: CloudProfile;
  workspace: CloudWorkspace;
  membership: CloudWorkspaceMembership;
}
