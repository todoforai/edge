import { MCPRunningStatus, type MCPServer } from '../../../shared/REST_types_shared';

export const FAKE_MCP_SERVERS: MCPServer[] = [
  {
    id: 'gmail',
    name: 'Gmail MCP',
    description: 'Access and manage Gmail emails with full authentication support',
    icon: 'logos:gmail',
    command: 'npx',
    args: ['@gongrzhe/server-gmail-autoauth-mcp'],
    env: {
      'GMAIL_CREDENTIALS_PATH': '/path/to/credentials.json'
    },
    status: MCPRunningStatus.UNINSTALLED,
    category: 'Communication'
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer MCP',
    description: 'Web automation and scraping using Puppeteer browser control',
    icon: 'simple-icons:puppeteer',
    command: 'node',
    args: ['/path/to/puppeteer-mcp-server/dist/index.js'],
    env: {},
    status: MCPRunningStatus.RUNNING,
    category: 'Web Automation'
  },
  {
    id: 'pdf-filler',
    name: 'PDF Filler',
    description: 'Fill PDF forms with Claude Desktop integration',
    icon: 'vscode-icons:file-type-pdf2',
    command: 'npx',
    args: ['@pdf-filler/mcp-server'],
    env: {},
    status: MCPRunningStatus.STOPPED,
    category: 'Documents'
  },
  {
    id: 'windows-mcp',
    name: 'Windows MCP',
    description: 'Lightweight MCP Server that enables Claude to interact with Windows OS',
    icon: 'logos:microsoft-windows',
    command: 'npx',
    args: ['@windows-mcp/server'],
    env: {},
    status: MCPRunningStatus.INSTALLED,
    category: 'System'
  },
  {
    id: 'macos-control',
    name: 'Control your Mac',
    description: 'Execute AppleScript to automate tasks on macOS',
    icon: 'logos:apple',
    command: 'npx',
    args: ['@macos-control/mcp-server'],
    env: {},
    status: MCPRunningStatus.UNINSTALLED,
    category: 'System'
  },
  {
    id: 'spotify-applescript',
    name: 'Spotify (AppleScript)',
    description: 'Control Spotify via AppleScript',
    icon: 'logos:spotify',
    command: 'npx',
    args: ['@spotify-applescript/mcp-server'],
    env: {},
    status: MCPRunningStatus.UNINSTALLED,
    category: 'Media'
  },
  {
    id: 'enrichr-mcp',
    name: 'Enrichr MCP Server',
    description: 'Gene set enrichment analysis using Enrichr API with multi-library support',
    icon: 'material-symbols:biotech',
    command: 'npx',
    args: ['@enrichr/mcp-server'],
    env: {},
    status: MCPRunningStatus.UNINSTALLED,
    category: 'Science'
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Manage resources in your Stripe account and search the Stripe documentation',
    icon: 'logos:stripe',
    command: 'npx',
    args: ['@stripe/mcp-server'],
    env: {
      'STRIPE_API_KEY': 'your_stripe_api_key'
    },
    status: MCPRunningStatus.UNINSTALLED,
    category: 'Finance'
  },
  {
    id: 'brave-applescript',
    name: 'Brave (AppleScript)',
    description: 'Control Brave Browser tabs, windows, and navigation',
    icon: 'logos:brave',
    command: 'npx',
    args: ['@brave-applescript/mcp-server'],
    env: {},
    status: MCPRunningStatus.UNINSTALLED,
    category: 'Web Automation'
  },
  {
    id: 'airtable-mcp',
    name: 'Airtable MCP Server',
    description: 'Read and write access to Airtable databases via the Model Context Protocol',
    icon: 'simple-icons:airtable',
    command: 'npx',
    args: ['@airtable/mcp-server'],
    env: {
      'AIRTABLE_API_KEY': 'your_airtable_api_key'
    },
    status: MCPRunningStatus.UNINSTALLED,
    category: 'Database'
  },
  {
    id: 'cucumber-studio',
    name: 'Cucumber Studio MCP',
    description: 'MCP server for Cucumber Studio API integration - access test scenarios, features, and projects',
    icon: 'simple-icons:cucumber',
    command: 'npx',
    args: ['@cucumber-studio/mcp-server'],
    env: {
      'CUCUMBER_STUDIO_API_TOKEN': 'your_api_token'
    },
    status: MCPRunningStatus.UNINSTALLED,
    category: 'Testing'
  },
  {
    id: 'socket-mcp',
    name: 'Socket MCP Server',
    description: 'Socket MCP server for scanning dependencies and security analysis',
    icon: 'material-symbols:security',
    command: 'npx',
    args: ['@socket/mcp-server'],
    env: {},
    status: MCPRunningStatus.UNINSTALLED,
    category: 'Security'
  }
];