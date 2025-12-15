import type { InstalledMCP } from './mcp.types';

export enum EdgeStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export enum DeviceType {
  PC = 'PC',
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  WEB_EXTENSION = 'WEB_EXTENSION',
  EXTENSION = 'EXTENSION',
}

export interface EdgeData {
  id: string;
  deviceType: DeviceType;
  metadata: Record<string, any>;
  name: string;
  workspacepaths: string[];
  installedMCPs: Record<string, InstalledMCP>;
  mcp_json?: Record<string, any>;
  mcp_config_path?: string;
  ownerId: string;
  status: EdgeStatus;
  createdAt: number;
}