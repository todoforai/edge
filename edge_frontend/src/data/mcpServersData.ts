import type { MCPRegistry } from '../types';

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
    aliases: ['GMAIL'],
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
    serverId: 'puppeteer',
    name: 'Puppeteer MCP',
    description: 'Web automation and scraping using Puppeteer browser control',
    command: 'npx',
    args: ['-y', 'github:Sixzero/puppeteer-mcp-server'],
    icon: '/logos/puppeteer.png', // Local downloaded logo
    env: {},
    category: ['Web Automation'],
    aliases: ['BROWSER'],
    repository: {
      url: 'https://github.com/Sixzero/puppeteer-mcp-server',
      source: 'github',
      id: 'Sixzero/puppeteer-mcp-server'
    },
    version_detail: {
      version: '2.1.0',
      release_date: '2024-02-01',
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
    aliases: ['SPOTIFY'],
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
    aliases: ['STRIPE'],
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
    aliases: ['BROWSER'],
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
    serverId: 'weather-mcp',
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
    aliases: ['WEATHER'],
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
  },
  {
    serverId: 'cloudflare',
    name: 'Cloudflare',
    description: 'Manage Cloudflare resources and configurations',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-cloudflare'],
    icon: '/logos/default.png',
    env: { 'CLOUDFLARE_API_TOKEN': '' },
    category: ['Cloud Services'],
    aliases: ['CLOUDFLARE'],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/cloudflare',
      source: 'npm',
      id: '@modelcontextprotocol/server-cloudflare'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'atlassian',
    name: 'Atlassian',
    description: 'Access Atlassian services like Jira and Confluence',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-atlassian'],
    icon: '/logos/default.png',
    env: { 
      'ATLASSIAN_API_TOKEN': '',
      'ATLASSIAN_BASE_URL': ''
    },
    category: ['Project Management'],
    aliases: ['ATLASSIAN', 'JIRA', 'CONFLUENCE'],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/atlassian',
      source: 'npm',
      id: '@modelcontextprotocol/server-atlassian'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'fireflies',
    name: 'Fireflies',
    description: 'AI-powered meeting notes and transcription service',
    command: 'npx',
    args: ['-y', '@props-labs/mcp/fireflies'],
    icon: '/logos/default.png',
    env: { 'FIREFLIES_API_KEY': '' },
    category: ['Communication'],
    aliases: ['FIREFLIES'],
    repository: {
      url: 'https://github.com/props-labs/mcp-fireflies',
      source: 'npm',
      id: '@props-labs/mcp/fireflies'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'google-drive',
    name: 'Google Drive',
    description: 'Access and manage Google Drive files and folders',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-drive'],
    icon: '/logos/default.png',
    env: { 'GOOGLE_API_CREDENTIALS': '' },
    category: ['Cloud Storage'],
    aliases: ['GOOGLE_DRIVE', 'DRIVE'],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-drive',
      source: 'npm',
      id: '@modelcontextprotocol/server-google-drive'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'google-calendar',
    name: 'Google Calendar',
    description: 'Manage Google Calendar events and schedules',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-calendar'],
    icon: '/logos/default.png',
    env: { 'GOOGLE_API_CREDENTIALS': '' },
    category: ['Productivity'],
    aliases: ['GOOGLE_CALENDAR', 'CALENDAR'],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-calendar',
      source: 'npm',
      id: '@modelcontextprotocol/server-google-calendar'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'google-mail',
    name: 'Google Mail (Official)',
    description: 'Official Google Mail MCP server',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-mail'],
    icon: '/logos/gmail.png',
    env: { 'GOOGLE_API_CREDENTIALS': '' },
    category: ['Communication'],
    aliases: ['GOOGLE_MAIL'],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-mail',
      source: 'npm',
      id: '@modelcontextprotocol/server-google-mail'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'canva',
    name: 'Canva',
    description: 'Design and create graphics with Canva',
    command: 'npx',
    args: ['-y', '@canva/cli', 'mcp'],
    icon: '/logos/default.png',
    env: {},
    category: ['Design'],
    aliases: ['CANVA'],
    repository: {
      url: 'https://github.com/canva/cli',
      source: 'npm',
      id: '@canva/cli'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'invideo',
    name: 'InVideo',
    description: 'AI video creation and editing platform',
    command: 'npx',
    args: ['mcp-remote', 'https://mcp.invideo.io/sse'],
    icon: '/logos/default.png',
    env: {},
    category: ['Media'],
    aliases: ['INVIDEO'],
    repository: {
      url: 'https://mcp.invideo.io',
      source: 'remote',
      id: 'invideo-remote'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'paypal',
    name: 'PayPal',
    description: 'Manage PayPal payments and transactions',
    command: 'npx',
    args: ['-y', '@paypal/mcp', '--tools=all'],
    icon: '/logos/default.png',
    env: { 
      'PAYPAL_ACCESS_TOKEN': '',
      'PAYPAL_ENVIRONMENT': 'SANDBOX'
    },
    category: ['Finance'],
    aliases: ['PAYPAL'],
    repository: {
      url: 'https://github.com/paypal/mcp-server',
      source: 'npm',
      id: '@paypal/mcp'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'sentry',
    name: 'Sentry',
    description: 'Application monitoring and error tracking',
    command: 'npx',
    args: ['-y', 'mcp-remote@latest', 'https://mcp.sentry.dev/mcp'],
    icon: '/logos/default.png',
    env: {
      'SENTRY_ACCESS_TOKEN': '',
      'SENTRY_HOST': ''
    },
    category: ['Development'],
    aliases: ['SENTRY'],
    repository: {
      url: 'https://mcp.sentry.dev',
      source: 'remote',
      id: 'sentry-remote'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'netlify',
    name: 'Netlify',
    description: 'Deploy and manage websites on Netlify',
    command: 'npx',
    args: ['-y', '@netlify/mcp'],
    icon: '/logos/default.png',
    env: { 'NETLIFY_PERSONAL_ACCESS_TOKEN': '' },
    category: ['Cloud Services'],
    aliases: ['NETLIFY'],
    repository: {
      url: 'https://github.com/netlify/mcp-server',
      source: 'npm',
      id: '@netlify/mcp'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'square',
    name: 'Square',
    description: 'Point of sale and payment processing',
    command: 'npx',
    args: ['mcp-remote', 'https://mcp.squareup.com/sse'],
    icon: '/logos/default.png',
    env: {},
    category: ['Finance'],
    aliases: ['SQUARE'],
    repository: {
      url: 'https://mcp.squareup.com',
      source: 'remote',
      id: 'square-remote'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'asana',
    name: 'Asana',
    description: 'Project management and task tracking',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-asana'],
    icon: '/logos/default.png',
    env: { 'ASANA_API_TOKEN': '' },
    category: ['Project Management'],
    aliases: ['ASANA'],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/asana',
      source: 'npm',
      id: '@modelcontextprotocol/server-asana'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'vercel',
    name: 'Vercel',
    description: 'Deploy and manage applications on Vercel',
    command: 'npx',
    args: ['mcp-remote', 'https://mcp.vercel.com'],
    icon: '/logos/default.png',
    env: {},
    category: ['Cloud Services'],
    aliases: ['VERCEL'],
    repository: {
      url: 'https://mcp.vercel.com',
      source: 'remote',
      id: 'vercel-remote'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'google-maps',
    name: 'Google Maps',
    description: 'Location services and mapping functionality',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-maps'],
    icon: '/logos/default.png',
    env: { 'GOOGLE_MAPS_API_KEY': '' },
    category: ['Mapping'],
    aliases: ['GOOGLE_MAPS', 'MAPS'],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps',
      source: 'npm',
      id: '@modelcontextprotocol/server-google-maps'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'zapier',
    name: 'Zapier',
    description: 'Automation and workflow integration',
    command: 'npx',
    args: ['mcp-remote', 'https://actions.zapier.com/mcp/YOUR_MCP_KEY/sse'],
    icon: '/logos/default.png',
    env: {},
    category: ['Automation'],
    aliases: ['ZAPIER'],
    repository: {
      url: 'https://actions.zapier.com',
      source: 'remote',
      id: 'zapier-remote'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'workato',
    name: 'Workato',
    description: 'Enterprise automation and integration platform',
    command: 'npx',
    args: ['-y', '@workato/mcp'],
    icon: '/logos/default.png',
    env: { 'WORKATO_API_KEY': '' },
    category: ['Automation'],
    aliases: ['WORKATO'],
    repository: {
      url: 'https://github.com/workato/mcp-server',
      source: 'npm',
      id: '@workato/mcp'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'bluesky',
    name: 'Bluesky',
    description: 'Social media platform integration',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-bluesky'],
    icon: '/logos/default.png',
    env: { 'BLUESKY_API_KEY': '' },
    category: ['Social Media'],
    aliases: ['BLUESKY'],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/bluesky',
      source: 'npm',
      id: '@modelcontextprotocol/server-bluesky'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'github',
    name: 'GitHub',
    description: 'GitHub repository and development tools',
    command: 'npx',
    args: ['mcp-remote', 'https://api.githubcopilot.com/mcp/'],
    icon: '/logos/default.png',
    env: {},
    category: ['Development'],
    aliases: ['GITHUB'],
    repository: {
      url: 'https://api.githubcopilot.com/mcp/',
      source: 'remote',
      id: 'github-remote'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'whatsapp',
    name: 'WhatsApp',
    description: 'WhatsApp messaging integration',
    command: 'python',
    args: ['-m', 'whatsapp_mcp'],
    icon: '/logos/default.png',
    env: {
      'GREENAPI_ID_INSTANCE': '',
      'GREENAPI_API_TOKEN': ''
    },
    category: ['Communication'],
    aliases: ['WHATSAPP'],
    repository: {
      url: 'https://github.com/whatsapp/mcp-server',
      source: 'python',
      id: 'whatsapp_mcp'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  },
  {
    serverId: 'slack',
    name: 'Slack',
    description: 'Slack workspace and messaging integration',
    command: 'npx',
    args: ['-y', 'slack-mcp-server'],
    icon: '/logos/default.png',
    env: { 'SLACK_BOT_TOKEN': '' },
    category: ['Communication'],
    aliases: ['SLACK'],
    repository: {
      url: 'https://github.com/slack/mcp-server',
      source: 'npm',
      id: 'slack-mcp-server'
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true
    }
  }
];

// Simple helper functions without global maps
export const getMCPByCommandArgs = (command: string, args: string[] = []): MCPRegistry | undefined => {
  const key = `${command}|${args.join('|')}`;
  return MOCK_MCP_REGISTRY.find(server => {
    const serverKey = `${server.command}|${(server.args || []).join('|')}`;
    return serverKey === key;
  });
};

export const getMCPByServerId = (serverId: string): MCPRegistry | undefined => {
  return MOCK_MCP_REGISTRY.find(server => server.serverId === serverId);
};