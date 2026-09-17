export const LOCAL_WORKSPACE_ID = "local-workspace";
export const PROJECT_NAME_MAX_LENGTH = 100;

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  eventDate?: string;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  workspaceId?: string;
}

export interface ProjectFactoryDependencies {
  createId: () => string;
  now: () => string;
}