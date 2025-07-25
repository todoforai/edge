import { type EdgeMCP, type MCPServer } from '../shared/REST_types_shared';

// Frontend: Convert EdgeMCP to MCPServer
export const convertMCPsToServers = (mcps: EdgeMCP[]): MCPServer[] => {
  return mcps.map(edgeMCP => {
    const serverInfo = getServerInfoFromId(edgeMCP.serverId);
    
    // Convert MCPEnv to Record<string, string>
    const envRecord: Record<string, string> = {};
    if (edgeMCP.env && typeof edgeMCP.env === 'object') {
      Object.entries(edgeMCP.env).forEach(([key, value]) => {
        if (key !== 'isActive' && typeof value === 'string') {
          envRecord[key] = value;
        }
      });
    }
    
    return {
      id: edgeMCP.serverId,
      status: edgeMCP.status,
      env: envRecord,
      name: serverInfo.name!,
      description: serverInfo.description!,
      command: serverInfo.command!,
      args: serverInfo.args!,
      icon: serverInfo.icon!,
      category: serverInfo.category!
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

