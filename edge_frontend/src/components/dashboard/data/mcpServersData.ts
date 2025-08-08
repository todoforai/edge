import type { MCPRegistry } from '../../../shared/REST_types_shared';

export const MOCK_MCP_REGISTRY: MCPRegistry[] = [
  {
    serverId: 'gmail',
    name: 'Gmail MCP',
    description: 'Access and manage Gmail emails with full authentication support',
    command: 'npx',
    args: ['@gongrzhe/server-gmail-autoauth-mcp'],
    icon: '/logos/gmail.png', // Local downloaded logo
    env: { 'GMAIL_CREDENTIALS_PATH': '' },
    category: ['Communication'],
    repository: {
      url: 'https://github.com/gongrzhe/server-gmail-autoauth-mcp',
      source: 'npm',
      id: '@gongrzhe/server-gmail-autoauth-mcp'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-15',
      is_latest: true
    }
  },
  {
    serverId: 'weather',
    name: 'Weather MCP',
    description: 'Get weather information and forecasts using AccuWeather API',
    command: 'uvx',
    args: ['--from', 'git+https://github.com/adhikasp/mcp-weather.git', 'mcp-weather'],
    icon: '/logos/weather.png',
    env: { 'ACCUWEATHER_API_KEY': 'your_api_key_here' },
    category: ['Weather'],
    repository: {
      url: 'https://github.com/adhikasp/mcp-weather.git',
      source: 'github',
      id: 'adhikasp/mcp-weather'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-02-20',
      is_latest: true
    }
  },
  {
    serverId: 'puppeteer',
    name: 'Puppeteer MCP',
    description: 'Web automation and scraping using Puppeteer browser control',
    command: 'npx',
    args: ['-y', 'puppeteer-mcp-server'],
    icon: '/logos/puppeteer.png', // Local downloaded logo
    env: {},
    category: ['Web Automation'],
    repository: {
      url: 'https://github.com/puppeteer/puppeteer-mcp',
      source: 'npm',
      id: 'puppeteer-mcp-server'
    },
    version_detail: {
      version: '2.1.0',
      release_date: '2024-02-01',
      is_latest: true
    }
  },
  {
    serverId: 'pdf-filler',
    name: 'PDF Filler',
    description: 'Fill PDF forms with Claude Desktop integration',
    command: 'npx',
    args: ['@pdf-filler/mcp-server'],
    icon: '/logos/pdf-filler.png', // Local downloaded logo
    category: ['Documents'],
    repository: {
      url: 'https://github.com/pdf-filler/mcp-server',
      source: 'npm',
      id: '@pdf-filler/mcp-server'
    },
    version_detail: {
      version: '1.2.3',
      release_date: '2024-01-20',
      is_latest: true
    }
  },
  {
    serverId: 'spotify-applescript',
    name: 'Spotify (AppleScript)',
    description: 'Control Spotify via AppleScript',
    command: 'npx',
    args: ['@spotify-applescript/mcp-server'],
    icon: '/logos/spotify.png', // Local downloaded logo
    category: ['Media'],
    repository: {
      url: 'https://github.com/spotify-applescript/mcp-server',
      source: 'npm',
      id: '@spotify-applescript/mcp-server'
    },
    version_detail: {
      version: '0.8.2',
      release_date: '2024-02-05',
      is_latest: false
    }
  },
  {
    serverId: 'stripe',
    name: 'Stripe',
    description: 'Manage resources in your Stripe account and search the Stripe documentation',
    command: 'npx',
    args: ['@stripe/mcp-server'],
    icon: '/logos/stripe.png', // Local downloaded logo
    env: { 'STRIPE_API_KEY': '' },
    category: ['Finance'],
    repository: {
      url: 'https://github.com/stripe/mcp-server',
      source: 'npm',
      id: '@stripe/mcp-server'
    },
    version_detail: {
      version: '1.5.0',
      release_date: '2024-02-12',
      is_latest: true
    }
  },
  {
    serverId: 'brave-applescript',
    name: 'Brave (AppleScript)',
    description: 'Control Brave Browser tabs, windows, and navigation',
    command: 'npx',
    args: ['@brave-applescript/mcp-server'],
    icon: '/logos/brave.png', // Local downloaded logo
    category: ['Web Automation'],
    repository: {
      url: 'https://github.com/brave-applescript/mcp-server',
      source: 'npm',
      id: '@brave-applescript/mcp-server'
    },
    version_detail: {
      version: '0.7.3',
      release_date: '2024-01-18',
      is_latest: true
    }
  },
  {
    serverId: 'airtable-mcp',
    name: 'Airtable MCP Server',
    description: 'Read and write access to Airtable databases via the Model Context Protocol',
    command: 'npx',
    args: ['@airtable/mcp-server'],
    icon: '/logos/airtable.png', // Local downloaded logo
    env: { 'AIRTABLE_API_KEY': '' },
    category: ['Database'],
    repository: {
      url: 'https://github.com/airtable/mcp-server',
      source: 'npm',
      id: '@airtable/mcp-server'
    },
    version_detail: {
      version: '1.3.2',
      release_date: '2024-02-08',
      is_latest: true
    }
  },
  {
    serverId: 'weather_mcp',
    name: 'Weather MCP (Smithery)',
    description: 'Weather information service using Smithery platform',
    command: 'npx',
    args: [
      '-y',
      '@smithery/cli@latest',
      'run',
      '@HarunGuclu/weather_mcp',
      '--key',
      'f5d19cb3-9510-4038-84d1-bbae0c5a8265',
      '--profile',
      'insufficient-anteater-eWo8lr'
    ],
    icon: '/logos/weather.png',
    env: {},
    category: ['Weather'],
    repository: {
      url: 'https://smithery.ai/@HarunGuclu/weather_mcp',
      source: 'smithery',
      id: '@HarunGuclu/weather_mcp'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-02-20',
      is_latest: true
    }
  }
];