import type { MCPRegistry } from '../types';

// Category constants - used for both UI grouping AND requirement matching
export const MCP_CATEGORY = {
  // Core
  BUILT_IN: 'Built-in',
  FILESYSTEM: 'Filesystem',

  // Web & Browser
  BROWSER: 'Browser',

  // Communication
  EMAIL: 'Email',
  MESSAGING: 'Messaging',
  CALENDAR: 'Calendar',

  // Audio/Voice
  TTS: 'Text-to-Speech',
  TRANSCRIPTION: 'Transcription',
  MUSIC: 'Music',

  // Video
  VIDEO: 'Video',

  // Location
  MAPS: 'Maps',
  WEATHER: 'Weather',

  // Technical
  DATABASE: 'Database',
  STORAGE: 'Storage',
  HOSTING: 'Hosting',
  DEVELOPMENT: 'Development',
  ERROR_TRACKING: 'Error Tracking',

  // Business
  PAYMENTS: 'Payments',
  PROJECT_MANAGEMENT: 'Project Management',
  AUTOMATION: 'Automation',
  DESIGN: 'Design',
  SOCIAL: 'Social',
  SALES: 'Sales',

  // AI
  AI: 'AI',
} as const;

export type MCPCategoryType = (typeof MCP_CATEGORY)[keyof typeof MCP_CATEGORY];

// Helper function to get default Gmail credentials path
const getDefaultGmailCredPath = () => {
  // For browser fallback, use the existing logic
  const p = navigator.userAgentData?.platform || navigator.userAgent || '';
  const isWin = /win/i.test(p);
  const home = isWin ? '%USERPROFILE%' : '~';
  const sep = isWin ? '\\' : '/';
  return `${home}${sep}.gmail-mcp${sep}credentials.json`;
};

export const MCP_REGISTRY: MCPRegistry[] = [
  // Built-in TODOforAI MCP
  {
    registryId: 'todoai',
    name: 'TODOforAI',
    description: 'Built-in file and shell operations',
    command: 'builtin',
    args: [],
    icon: '/T-rocket-middle.png',
    env: {},
    category: [MCP_CATEGORY.BUILT_IN, MCP_CATEGORY.FILESYSTEM],
    repository: {
      url: 'https://github.com/todoforai/edge',
      source: 'builtin',
      id: 'todoai-builtin',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
    tools: [
      {
        name: 'create_file',
        description: 'Create a new file with specified content',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            content: { type: 'string', description: 'File content' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'modify_file',
        description: 'Modify an existing file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            content: { type: 'string', description: 'New content' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'execute_shell',
        description: 'Execute shell command',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Shell command to execute' },
          },
          required: ['command'],
        },
      },
    ],
  },
  {
    registryId: 'gmail',
    name: 'Gmail MCP',
    description: 'Access and manage Gmail emails with full authentication support',
    command: 'npx',
    args: ['-y', '@todoforai/server-gmail-autoauth-mcp'],
    icon: '/logos/gmail.png',
    env: {
      GMAIL_CREDENTIALS_PATH: getDefaultGmailCredPath(),
    },
    setup: {
      instructions: [
        'Before using Gmail you need to authenticate.',
        'Quick auth:',
        'npx -y @todoforai/server-gmail-autoauth-mcp auth',
        '',
        'BYO OAuth client (optional):',
        '- Place gcp-oauth.keys.json in your project dir or ~/.gmail-mcp/',
        '- Or set GMAIL_OAUTH_PATH or GMAIL_OAUTH_URL',
        '',
        'Notes:',
        '- Uses GMAIL_OAUTH_URL or defaults to https://api.todofor.ai/gmail-oauth.json',
        '- Stores tokens at ~/.gmail-mcp/credentials.json',
      ].join('\n'),
    },
    category: [MCP_CATEGORY.EMAIL],
    repository: {
      url: 'https://github.com/todoforai/Gmail-MCP-Server',
      source: 'npm',
      id: '@todoforai/server-gmail-autoauth-mcp',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-15',
      is_latest: true,
    },
  },
  {
    registryId: 'mongodb',
    name: 'MongoDB',
    description: 'Interact with MongoDB databases - query, aggregate, update, insert, and manage collections',
    command: 'npx',
    args: ['-y', 'mcp-mongo-server'],
    icon: '/logos/mongodb.png',
    env: {
      MCP_MONGODB_URI: '',
      MCP_MONGODB_READONLY: 'false',
    },
    setup: {
      instructions: [
        'MongoDB MCP Server Configuration:',
        '',
        'Required:',
        '- Set MCP_MONGODB_URI to your MongoDB connection string',
        '  Example: mongodb://user:pass@localhost:27017/database',
        '',
        'Optional:',
        '- Set MCP_MONGODB_READONLY to "true" for read-only mode',
        '  (recommended for production databases)',
        '',
        'Features:',
        '- Smart ObjectId handling with auto/none/force modes',
        '- Query, aggregate, count operations',
        '- Update, insert, createIndex (when not read-only)',
        '- Collection schema inference',
        '- Execution plan analysis',
        '',
        'Read-only mode uses secondary read preference for optimal performance.',
      ].join('\n'),
    },
    category: [MCP_CATEGORY.DATABASE],
    repository: {
      url: 'https://github.com/kiliczsh/mcp-mongo-server',
      source: 'npm',
      id: 'mcp-mongo-server',
    },
    version_detail: {
      version: '1.3.0',
      release_date: '2025-04-26',
      is_latest: true,
    },
  },
  {
    registryId: 'playwright',
    name: 'Playwright',
    description: 'Web automation and testing using Playwright',
    command: 'npx',
    args: ['@playwright/mcp@latest'],
    icon: '/logos/playwright.png',
    env: {},
    category: [MCP_CATEGORY.BROWSER],
    repository: {
      url: 'https://github.com/microsoft/playwright',
      source: 'npm',
      id: '@playwright/mcp',
    },
    version_detail: {
      version: 'latest',
      release_date: '2025-08-01',
      is_latest: true,
    },
  },
  {
    registryId: 'puppeteer',
    name: 'Puppeteer MCP',
    description: 'Web automation and scraping using Puppeteer browser control',
    command: 'npx',
    args: ['-y', '@todoforai/puppeteer-mcp-server'],
    icon: '/logos/puppeteer.png', // Local downloaded logo
    env: {},
    category: [MCP_CATEGORY.BROWSER],
    repository: {
      url: 'https://github.com/todoforai/puppeteer-mcp-server',
      source: 'github',
      id: '@todoforai/puppeteer-mcp-server',
    },
    version_detail: {
      version: '2.1.0',
      release_date: '2024-02-01',
      is_latest: true,
    },
  },
  {
    registryId: 'spotify-applescript',
    name: 'Spotify (AppleScript)',
    description: 'Control Spotify via AppleScript',
    command: 'npx',
    args: ['@spotify-applescript/mcp-server'],
    icon: '/logos/spotify.png', // Local downloaded logo
    category: [MCP_CATEGORY.MUSIC],
    repository: {
      url: 'https://github.com/spotify-applescript/mcp-server',
      source: 'npm',
      id: '@spotify-applescript/mcp-server',
    },
    version_detail: {
      version: '0.8.2',
      release_date: '2024-02-05',
      is_latest: false,
    },
  },
  {
    registryId: 'stripe',
    name: 'Stripe',
    description: 'Manage resources in your Stripe account and search the Stripe documentation',
    command: 'npx',
    args: ['@stripe/mcp-server'],
    icon: '/logos/stripe.png', // Local downloaded logo
    env: { STRIPE_API_KEY: '' },
    category: [MCP_CATEGORY.PAYMENTS],
    repository: {
      url: 'https://github.com/stripe/mcp-server',
      source: 'npm',
      id: '@stripe/mcp-server',
    },
    version_detail: {
      version: '1.5.0',
      release_date: '2024-02-12',
      is_latest: true,
    },
  },
  {
    registryId: 'brave-applescript',
    name: 'Brave (AppleScript)',
    description: 'Control Brave Browser tabs, windows, and navigation',
    command: 'npx',
    args: ['@brave-applescript/mcp-server'],
    icon: '/logos/brave.png', // Local downloaded logo
    category: [MCP_CATEGORY.BROWSER],
    repository: {
      url: 'https://github.com/brave-applescript/mcp-server',
      source: 'npm',
      id: '@brave-applescript/mcp-server',
    },
    version_detail: {
      version: '0.7.3',
      release_date: '2024-01-18',
      is_latest: true,
    },
  },
  {
    registryId: 'weather-mcp',
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
      'insufficient-anteater-eWo8lr',
    ],
    icon: '/logos/weather.png',
    env: {},
    category: [MCP_CATEGORY.WEATHER],
    repository: {
      url: 'https://smithery.ai/@HarunGuclu/weather_mcp',
      source: 'smithery',
      id: '@HarunGuclu/weather_mcp',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-02-20',
      is_latest: true,
    },
  },
  {
    registryId: 'cloudflare',
    name: 'Cloudflare',
    description: 'Manage Cloudflare resources and configurations',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-cloudflare'],
    icon: '/logos/cloudflare.png',
    env: { CLOUDFLARE_API_TOKEN: '' },
    category: [MCP_CATEGORY.HOSTING],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/cloudflare',
      source: 'npm',
      id: '@modelcontextprotocol/server-cloudflare',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'atlassian',
    name: 'Atlassian',
    description: 'Access Atlassian services like Jira and Confluence',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-atlassian'],
    icon: '/logos/atlassian.png',
    env: {
      ATLASSIAN_API_TOKEN: '',
      ATLASSIAN_BASE_URL: '',
    },
    category: [MCP_CATEGORY.PROJECT_MANAGEMENT],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/atlassian',
      source: 'npm',
      id: '@modelcontextprotocol/server-atlassian',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'fireflies',
    name: 'Fireflies',
    description: 'AI-powered meeting notes and transcription service',
    command: 'npx',
    args: ['-y', '@props-labs/mcp/fireflies'],
    icon: '/logos/fireflies.png',
    env: { FIREFLIES_API_KEY: '' },
    category: [MCP_CATEGORY.TRANSCRIPTION],
    repository: {
      url: 'https://github.com/props-labs/mcp-fireflies',
      source: 'npm',
      id: '@props-labs/mcp/fireflies',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'google-drive',
    name: 'Google Drive',
    description: 'Access and manage Google Drive files and folders',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-drive'],
    icon: '/logos/google-drive.png',
    env: { GOOGLE_API_CREDENTIALS: '' },
    category: [MCP_CATEGORY.STORAGE],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-drive',
      source: 'npm',
      id: '@modelcontextprotocol/server-google-drive',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'google-calendar',
    name: 'Google Calendar',
    description: 'Manage Google Calendar events and schedules with multi-calendar support, recurring events, and smart scheduling',
    command: 'npx',
    args: ['-y', '@cocal/google-calendar-mcp'],
    icon: '/logos/google-calendar.png',
    env: {
      GOOGLE_OAUTH_CREDENTIALS: '',
      GOOGLE_CALENDAR_MCP_TOKEN_PATH: '',
    },
    setup: {
      instructions: [
        'Before using Google Calendar you need to set up OAuth credentials:',
        '',
        '1. Go to Google Cloud Console (https://console.cloud.google.com)',
        '2. Create/select a project and enable Calendar API',
        '3. Create OAuth 2.0 credentials (Desktop app type)',
        '4. Download credentials and set GOOGLE_OAUTH_CREDENTIALS path',
        '5. Add your email as a test user in OAuth consent screen',
        '',
        'First-time authentication:',
        'export GOOGLE_OAUTH_CREDENTIALS="/path/to/gcp-oauth.keys.json"',
        'npx @cocal/google-calendar-mcp auth',
        '',
        'Note: Tokens expire after 7 days in test mode.',
        'To avoid re-auth, publish app to production mode (unverified).',
      ].join('\n'),
    },
    category: [MCP_CATEGORY.CALENDAR],
    repository: {
      url: 'https://github.com/nspady/google-calendar-mcp',
      source: 'npm',
      id: '@cocal/google-calendar-mcp',
    },
    version_detail: {
      version: '1.4.8',
      release_date: '2025-07-03',
      is_latest: true,
    },
  },
  {
    registryId: 'google-mail',
    name: 'Google Mail (Official)',
    description: 'Official Google Mail MCP server',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-mail'],
    icon: '/logos/gmail.png',
    env: { GOOGLE_API_CREDENTIALS: '' },
    category: [MCP_CATEGORY.EMAIL],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-mail',
      source: 'npm',
      id: '@modelcontextprotocol/server-google-mail',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'canva',
    name: 'Canva',
    description: 'Design and create graphics with Canva',
    command: 'npx',
    args: ['-y', '@canva/cli', 'mcp'],
    icon: '/logos/canva.png',
    env: {},
    category: [MCP_CATEGORY.DESIGN],
    repository: {
      url: 'https://github.com/canva/cli',
      source: 'npm',
      id: '@canva/cli',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'invideo',
    name: 'InVideo',
    description: 'AI video creation and editing platform',
    command: 'npx',
    args: ['mcp-remote', 'https://mcp.invideo.io/sse'],
    icon: '/logos/invideo.png',
    env: {},
    category: [MCP_CATEGORY.VIDEO],
    repository: {
      url: 'https://mcp.invideo.io',
      source: 'remote',
      id: 'invideo-remote',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'paypal',
    name: 'PayPal',
    description: 'Manage PayPal payments and transactions',
    command: 'npx',
    args: ['-y', '@paypal/mcp', '--tools=all'],
    icon: '/logos/paypal.png',
    env: {
      PAYPAL_ACCESS_TOKEN: '',
      PAYPAL_ENVIRONMENT: 'SANDBOX',
    },
    category: [MCP_CATEGORY.PAYMENTS],
    repository: {
      url: 'https://github.com/paypal/mcp-server',
      source: 'npm',
      id: '@paypal/mcp',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'sentry',
    name: 'Sentry',
    description: 'Application monitoring and error tracking',
    command: 'npx',
    args: ['-y', 'mcp-remote@latest', 'https://mcp.sentry.dev/mcp'],
    icon: '/logos/sentry.png',
    env: {
      SENTRY_ACCESS_TOKEN: '',
      SENTRY_HOST: '',
    },
    category: [MCP_CATEGORY.ERROR_TRACKING],
    repository: {
      url: 'https://mcp.sentry.dev',
      source: 'remote',
      id: 'sentry-remote',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'netlify',
    name: 'Netlify',
    description: 'Deploy and manage websites on Netlify',
    command: 'npx',
    args: ['-y', '@netlify/mcp'],
    icon: '/logos/netlify.png',
    env: { NETLIFY_PERSONAL_ACCESS_TOKEN: '' },
    category: [MCP_CATEGORY.HOSTING],
    repository: {
      url: 'https://github.com/netlify/mcp-server',
      source: 'npm',
      id: '@netlify/mcp',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'square',
    name: 'Square',
    description: 'Point of sale and payment processing',
    command: 'npx',
    args: ['mcp-remote', 'https://mcp.squareup.com/sse'],
    icon: '/logos/square.png',
    env: {},
    category: [MCP_CATEGORY.PAYMENTS],
    repository: {
      url: 'https://mcp.squareup.com',
      source: 'remote',
      id: 'square-remote',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'asana',
    name: 'Asana',
    description: 'Project management and task tracking',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-asana'],
    icon: '/logos/asana.png',
    env: { ASANA_API_TOKEN: '' },
    category: [MCP_CATEGORY.PROJECT_MANAGEMENT],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/asana',
      source: 'npm',
      id: '@modelcontextprotocol/server-asana',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'vercel',
    name: 'Vercel',
    description: 'Deploy and manage applications on Vercel',
    command: 'npx',
    args: ['mcp-remote', 'https://mcp.vercel.com'],
    icon: '/logos/vercel.png',
    env: {},
    category: [MCP_CATEGORY.HOSTING],
    repository: {
      url: 'https://mcp.vercel.com',
      source: 'remote',
      id: 'vercel-remote',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'google-maps',
    name: 'Google Maps',
    description: 'Location services and mapping functionality',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-google-maps'],
    icon: '/logos/google-maps.png',
    env: { GOOGLE_MAPS_API_KEY: '' },
    category: [MCP_CATEGORY.MAPS],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps',
      source: 'npm',
      id: '@modelcontextprotocol/server-google-maps',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'zapier',
    name: 'Zapier',
    description: 'Automation and workflow integration',
    command: 'npx',
    args: ['mcp-remote', 'https://actions.zapier.com/mcp/YOUR_MCP_KEY/sse'],
    icon: '/logos/zapier.png',
    env: {},
    category: [MCP_CATEGORY.AUTOMATION],
    repository: {
      url: 'https://actions.zapier.com',
      source: 'remote',
      id: 'zapier-remote',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'workato',
    name: 'Workato',
    description: 'Enterprise automation and integration platform',
    command: 'npx',
    args: ['-y', '@workato/mcp'],
    icon: '/logos/workato.png',
    env: { WORKATO_API_KEY: '' },
    category: [MCP_CATEGORY.AUTOMATION],
    repository: {
      url: 'https://github.com/workato/mcp-server',
      source: 'npm',
      id: '@workato/mcp',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'bluesky',
    name: 'Bluesky',
    description: 'Social media platform integration',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-bluesky'],
    icon: '/logos/bluesky.png',
    env: { BLUESKY_API_KEY: '' },
    category: [MCP_CATEGORY.SOCIAL, MCP_CATEGORY.MESSAGING],
    repository: {
      url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/bluesky',
      source: 'npm',
      id: '@modelcontextprotocol/server-bluesky',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'github',
    name: 'GitHub',
    description: 'GitHub repository and development tools',
    command: 'npx',
    args: ['mcp-remote', 'https://api.githubcopilot.com/mcp/'],
    icon: '/logos/github.png',
    env: {},
    category: [MCP_CATEGORY.DEVELOPMENT],
    repository: {
      url: 'https://api.githubcopilot.com/mcp/',
      source: 'remote',
      id: 'github-remote',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'whatsapp',
    name: 'WhatsApp',
    description: 'WhatsApp messaging integration',
    command: 'python',
    args: ['-m', 'whatsapp_mcp'],
    icon: '/logos/whatsapp.png',
    env: {
      GREENAPI_ID_INSTANCE: '',
      GREENAPI_API_TOKEN: '',
    },
    category: [MCP_CATEGORY.MESSAGING],
    repository: {
      url: 'https://github.com/whatsapp/mcp-server',
      source: 'python',
      id: 'whatsapp_mcp',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'slack',
    name: 'Slack',
    description: 'Slack workspace and messaging integration',
    command: 'npx',
    args: ['-y', 'slack-mcp-server'],
    icon: '/logos/slack.png',
    env: { SLACK_BOT_TOKEN: '' },
    category: [MCP_CATEGORY.MESSAGING],
    repository: {
      url: 'https://github.com/slack/mcp-server',
      source: 'npm',
      id: 'slack-mcp-server',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'suno',
    name: 'Suno Music Generator',
    description: 'AI-powered music generation using Suno API - create songs with custom lyrics, styles, and titles',
    command: 'npx',
    args: ['-y', 'github:todoforai/MCP-Suno'],
    icon: '/logos/suno.png',
    env: {
      SunoKey: '',
    },
    setup: {
      instructions: [
        'Suno Music Generator Configuration:',
        '',
        'Required:',
        '- Set SunoKey to your Suno API key (format: sk_YOUR_API_KEY)',
        '',
        'Features:',
        '- Custom mode: Provide lyrics, style tags, and title',
        '- Inspiration mode: Provide a description and let AI generate',
        '- Continue generation: Extend existing songs',
        '- Model versions: chirp-v3-0, chirp-v3-5, chirp-v4 (default)',
        '- Instrumental mode support',
        '',
        'Usage Examples:',
        '- Custom: "Generate a folk song with lyrics about nature"',
        '- Inspiration: "Create a lofi chill beat for coding"',
        '- Continue: "Extend the previous song from 60 seconds"',
        '',
        'Note: Generation may take a few minutes as it polls for results.',
      ].join('\n'),
    },
    category: [MCP_CATEGORY.MUSIC, MCP_CATEGORY.AI],
    repository: {
      url: 'https://github.com/todoforai/MCP-Suno',
      source: 'github',
      id: 'todoforai/MCP-Suno',
    },
    version_detail: {
      version: '1.0.0',
      release_date: '2024-01-01',
      is_latest: true,
    },
  },
  {
    registryId: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Text-to-speech, voice cloning, audio processing, and conversational AI agents',
    command: 'uvx',
    args: ['elevenlabs-mcp'],
    icon: '/logos/elevenlabs.png',
    env: {
      ELEVENLABS_API_KEY: '',
      ELEVENLABS_MCP_BASE_PATH: '',
      ELEVENLABS_API_RESIDENCY: 'us',
      ELEVENLABS_MCP_OUTPUT_MODE: 'both',
    },
    setup: {
      instructions: [
        'ElevenLabs MCP Server Configuration:',
        '',
        'Required:',
        '- Set ELEVENLABS_API_KEY (get from https://elevenlabs.io/app/settings/api-keys)',
        '- Free tier: 10k credits per month',
        '',
        'Optional:',
        '- ELEVENLABS_MCP_BASE_PATH: Base path for file operations (default: ~/Desktop)',
        '- ELEVENLABS_API_RESIDENCY: Data residency region (us, eu-residency, in-residency, global)',
        '- ELEVENLABS_MCP_OUTPUT_MODE: How files are returned (files, resources, both)',
        '',
        'Output Modes:',
        '- files: Save to disk and return file paths (default)',
        '- resources: Return as base64-encoded MCP resources',
        '- both: Save to disk AND return as resources',
        '',
        'Features:',
        '- Text-to-speech with multiple voices and models',
        '- Voice cloning and voice design',
        '- Speech-to-text transcription with diarization',
        '- Sound effects generation',
        '- Audio isolation and speech-to-speech conversion',
        '- Conversational AI agents with phone integration',
        '- Music composition',
        '',
        '⚠️ Note: Most tools require API credits and may incur costs',
      ].join('\n'),
    },
    category: [MCP_CATEGORY.TTS, MCP_CATEGORY.TRANSCRIPTION, MCP_CATEGORY.AI],
    repository: {
      url: 'https://github.com/elevenlabs/elevenlabs-mcp',
      source: 'pypi',
      id: 'elevenlabs-mcp',
    },
    version_detail: {
      version: '0.9.0',
      release_date: '2025-01-25',
      is_latest: true,
    },
  },
  {
    registryId: 'apollo-io',
    name: 'Apollo.io MCP',
    description: 'Apollo.io sales data tools (enrich, search, job postings)',
    command: 'npx',
    args: ['-y', 'github:lkm1developer/apollo-io-mcp-server'],
    icon: 'mdi:chart-line',
    env: {
      APOLLO_IO_API_KEY: '',
    },
    setup: {
      instructions: [
        'Apollo.io MCP Configuration:',
        '',
        'Required:',
        '- Set APOLLO_IO_API_KEY from Apollo.io Settings > API',
      ].join('\n'),
    },
    category: [MCP_CATEGORY.SALES],
    repository: {
      url: 'https://github.com/lkm1developer/apollo-io-mcp-server',
      source: 'github',
      id: 'lkm1developer/apollo-io-mcp-server',
    },
    version_detail: {
      version: '0.1.0',
      release_date: '2025-12-09',
      is_latest: true,
    },
  },
];

// Simple helper functions without global maps
export const getMCPByCommandArgs = (command: string, args: string[] = []): MCPRegistry | undefined => {
  const norm = (a: string[] = []) => a.map((s) => (s?.startsWith('github:') ? s.slice(7) : s));
  const key = `${command}|${norm(args).join('|')}`;
  return MCP_REGISTRY.find((server) => {
    const serverKey = `${server.command}|${norm(server.args || []).join('|')}`;
    return serverKey === key;
  });
};

export const getMCPByRegistryID = (registryId: string | undefined): MCPRegistry | undefined => {
  if (!registryId) return undefined;
  return MCP_REGISTRY.find((server) => server.registryId === registryId);
};

export const findMCPByCategory = (category: MCPCategoryType): MCPRegistry[] => {
  return MCP_REGISTRY.filter((server) => server.category?.includes(category));
};

export const findMCPByName = (query: string): MCPRegistry[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return MCP_REGISTRY.filter(
    (server) =>
      server.name?.toLowerCase().includes(q) ||
      server.registryId.toLowerCase().includes(q) ||
      server.category?.some((c) => c.toLowerCase().includes(q))
  );
};
