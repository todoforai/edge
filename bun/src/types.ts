export interface Project {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  ownerId: string;
  ownerEmail: string;
  todoIds: string[];
  readAccessIds: string[];
  writeAccessIds: string[];
  readAccessEmails: string[];
  writeAccessEmails: string[];
  context?: any;
  projectSettingsId: string;
  isDefault: boolean;
  status: string;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
  deletedAt?: number;
  dataSourceIds: string[];
}

export interface ProjectSettings {
  id: string;
  projectId: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectListItem {
  project: Project;
  settings: ProjectSettings;
}

export interface AgentSettings {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  systemMessage?: string;
  mcpConfigs: Record<string, any>;
  edgesMcpConfigs: Record<string, any>;
  skills: Record<string, any>;
  model: string;
  plannerModel?: string;
  automaticInstantDiff: boolean;
  automaticRunShell: boolean;
}

export interface TodoMessage {
  id: string;
  createdAt: number;
  blockTypes: any[];
  blocks: any;
  ctx: Record<string, any>;
  runMeta: any[];
  stop_sequence: string;
  scheduledTimestamp: number;
  todoId: string;
  role: string;
  content: string;
  agentSettingsId: string;
  attachments: Record<string, any>[];
}

export interface Todo {
  id: string;
  projectId: string;
  status: string;
  agentSettingsId: string;
  content: string;
  messageIds: string[];
  messages?: TodoMessage[];
  createdAt: number;
  lastActivityAt: number;
  scheduledTimestamp?: number;
  isNewTodo?: boolean;
}

export interface EdgeConfigData {
  id: string;
  name: string;
  workspacepaths: string[];
  ownerId: string;
  status: string;
  isShellEnabled: boolean;
  isFileSystemEnabled: boolean;
  createdAt?: string;
}
