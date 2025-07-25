import type { EdgeMCP, MCPServer } from '../shared/REST_types_shared';
import { MCPRunningStatus } from '../shared/REST_types_shared';

export const convertEdgeMCPsToServers = (edgeMCPs: EdgeMCP[]): MCPServer[] => {
  console.log('Edge MCPs:', edgeMCPs);
  return edgeMCPs.map(edgeMCP => {
    const serverInfo = getServerInfoFromId(edgeMCP.serverId);
    
    // Map backend status to frontend status
    const mapStatus = (backendStatus: MCPRunningStatus): MCPServer['status'] => {
      switch (backendStatus) {
        case MCPRunningStatus.RUNNING: return MCPRunningStatus.RUNNING;
        case MCPRunningStatus.STOPPED: return MCPRunningStatus.STOPPED;
        case MCPRunningStatus.ERROR: return MCPRunningStatus.ERROR;
        default: return MCPRunningStatus.STOPPED;
      }
    };

    // Extract environment variables (excluding isActive)
    const { isActive, ...envVars } = edgeMCP.env;

    return {
      id: edgeMCP.serverId,
      name: serverInfo.name || `${edgeMCP.serverId} MCP`,
      description: `${serverInfo.description || `MCP server for ${edgeMCP.serverId}`} (${edgeMCP.tools.length} tools available)${edgeMCP.error ? ` - Error: ${edgeMCP.error}` : ''}`,
      icon: serverInfo.icon || 'lucide:server',
      command: serverInfo.command || 'npx',
      args: serverInfo.args || [`@${edgeMCP.serverId}/mcp-server`],
      env: { ...serverInfo.env, ...envVars },
      status: edgeMCP.enabled ? mapStatus(edgeMCP.status) : MCPRunningStatus.STOPPED,
      category: serverInfo.category || 'System',
    };
  });
};

// Map server IDs to server information
const getServerInfoFromId = (serverId: string) => {
  const serverMap: Record<string, Partial<MCPServer>> = {
    'puppeteer': {
      name: 'Puppeteer MCP',
      description: 'Web automation and scraping using Puppeteer browser control',
      icon: 'simple-icons:puppeteer',
      command: 'node',
      args: ['/path/to/puppeteer-mcp-server/dist/index.js'],
      env: {},
      category: 'Web Automation'
    },
    'gmail': {
      name: 'Gmail MCP',
      description: 'Access and manage Gmail emails with full authentication support',
      icon: 'logos:gmail',
      command: 'npx',
      args: ['@gongrzhe/server-gmail-autoauth-mcp'],
      env: { 'GMAIL_CREDENTIALS_PATH': '/path/to/credentials.json' },
      category: 'Communication'
    },
    'filesystem': {
      name: 'File System MCP',
      description: 'File system operations and management',
      icon: 'lucide:folder',
      command: 'npx',
      args: ['@filesystem/mcp-server'],
      env: {},
      category: 'System'
    },
    'shell': {
      name: 'Shell MCP',
      description: 'Execute shell commands and scripts',
      icon: 'lucide:terminal',
      command: 'npx',
      args: ['@shell/mcp-server'],
      env: {},
      category: 'System'
    }
  };

  return serverMap[serverId] || {
    name: `${serverId} MCP`,
    description: `MCP server for ${serverId}`,
    icon: 'lucide:server',
    command: 'npx',
    args: [`@${serverId}/mcp-server`],
    env: {},
    category: 'Unknown'
  };
};