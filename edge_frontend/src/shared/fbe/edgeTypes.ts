import type { InstalledMCP } from './mcpTypes';

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
  CLI = 'cli',
}

/** A connected edge device (local computer, phone, extension). */
export interface EdgeData {
  id: string;
  deviceType: DeviceType;
  metadata: Record<string, any>;
  name: string;
  /** Local filesystem paths the agent can access */
  workspacepaths: string[];
  /** MCP servers installed on this device */
  installedMCPs: Record<string, InstalledMCP>;
  /** Raw MCP config JSON */
  mcp_json?: Record<string, any>;
  mcp_config_path?: string;
  ownerId: string;
  status: EdgeStatus;
  createdAt: number;
}
