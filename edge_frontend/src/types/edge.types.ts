import { InstalledMCP } from './mcp.types';

export enum EdgeStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export interface EdgeData {
  id: string;
  name: string;
  workspacepaths: string[];
  installedMCPs: Record<string, InstalledMCP>;
  mcp_json?: Record<string, any>;
  ownerId: string;
  status: EdgeStatus;
  isShellEnabled: boolean;
  isFileSystemEnabled: boolean;
  createdAt: number;
}