import type { EdgeMCP, MCPServer, MCPToolSkeleton } from '../shared/REST_types_shared';
import { MCPRunningStatus } from '../shared/REST_types_shared';

// Frontend: Just use the data directly
export const convertMCPsToServers = (mcps: MCPServer[]): MCPServer[] => {
  return mcps; // No conversion needed!
};
export const convertEdgeMCPsToServers = (edgeMCPs: any[]): MCPServer[] => {
  console.log('Edge MCPs:', edgeMCPs);
  
  // Check if we received raw tool data instead of EdgeMCP objects
  if (edgeMCPs.length > 0 && 'inputSchema' in edgeMCPs[0]) {
    // Convert raw tool data to EdgeMCP format first
    const edgeMCPsFromTools = convertToolsToEdgeMCPs(edgeMCPs);
    return edgeMCPsFromTools.map(convertSingleEdgeMCP);
  }
  
  // Handle normal EdgeMCP objects
  return edgeMCPs.map(convertSingleEdgeMCP);
};

const convertToolsToEdgeMCPs = (tools: any[]): EdgeMCP[] => {
  // Group tools by server_id
  const servers = new Map<string, EdgeMCP>();
  
  tools.forEach(tool => {
    const serverId = tool.server_id || inferServerIdFromToolName(tool.name);
    
    if (!servers.has(serverId)) {
      servers.set(serverId, {
        serverId,
        status: MCPRunningStatus.STOPPED,
        tools: [],
        env: { isActive: true },
        config: { isActive: true },
        enabled: true
      });
    }
    
    servers.get(serverId)!.tools.push({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    });
  });
  
  return Array.from(servers.values());
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

