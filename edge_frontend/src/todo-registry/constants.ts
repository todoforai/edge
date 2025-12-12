
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