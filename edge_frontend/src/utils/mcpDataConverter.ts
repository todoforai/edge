import type { MCPServer } from '../components/dashboard/types/MCPServer';

interface MCPToolSkeleton {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface MCPEnv {
  isActive: boolean;
  [envName: string]: any;
}

type MCPRunningStatus = 'running' | 'stopped' | 'error' | 'starting' | 'stopping';

interface EdgeMCP {
  serverId: string;
  tools: MCPToolSkeleton[];
  env: MCPEnv;
  config: MCPEnv;
  enabled: boolean;
  status: MCPRunningStatus;
  error?: string;
}

export const convertEdgeMCPsToServers = (edgeMCPs: EdgeMCP[]): MCPServer[] => {
  return edgeMCPs.map(edgeMCP => {
    const serverInfo = getServerInfoFromId(edgeMCP.serverId);
    
    // Map backend status to frontend status
    const mapStatus = (backendStatus: MCPRunningStatus): MCPServer['status'] => {
      switch (backendStatus) {
        case 'running': return 'running';
        case 'stopped': return 'stopped';
        case 'error': return 'stopped';
        case 'starting': return 'running';
        case 'stopping': return 'stopped';
        default: return 'stopped';
      }
    };

    // Extract environment variables (excluding isActive)
    const { isActive, ...envVars } = edgeMCP.env;

    return {
      id: edgeMCP.serverId,
      name: serverInfo.name,
      description: `${serverInfo.description} (${edgeMCP.tools.length} tools available)${edgeMCP.error ? ` - Error: ${edgeMCP.error}` : ''}`,
      icon: serverInfo.icon,
      command: serverInfo.command,
      args: serverInfo.args,
      env: { ...serverInfo.env, ...envVars },
      status: edgeMCP.enabled ? mapStatus(edgeMCP.status) : 'stopped',
      category: serverInfo.category,
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