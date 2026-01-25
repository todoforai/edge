// TODO categories for classification
// Used for both TODOs and TODO packs to indicate what domain they cover
export const TODO_CATEGORIES = [
  /**
   * Minimal, distinct taxonomy focused on digital/online presence channels.
   *
   * Principle: if two labels are commonly applied together, merge them.
   * Execution primitives ("Web Automation", "Coding", etc.) are intentionally NOT categories here.
   */

  // Discovery
  'SEO', // organic search + backlinks
  'Directories', // listings/submissions (Product Hunt, G2, etc.)

  // Product / website
  'Development', // building/shipping the product & website that people discover

  // Acquisition / distribution
  'Sales', // outbound + prospecting workflows
  'Social', // social posting/repurposing/scheduling workflows
  'Email', // newsletters, sequences
  'Advertising', // paid acquisition + creative ops

  // Trust
  'Reviews', // review sites & reputation

  // Escape hatch (avoid when possible)
  'Other',
] as const;

export type TodoCategoryType = (typeof TODO_CATEGORIES)[number];

/**
 * Old categories kept only for backwards compatibility with existing TOML files.
 * Prefer using `TODO_CATEGORIES` above for any new TODOs.
 */
export const LEGACY_TODO_CATEGORIES = [
  'Marketing',
  'AEO',
  'PR',
  'Affiliates',
  'Influencer',
  'Business',
  'Legal',
  'Finance',
  'DevOps',
  'Design',
  'Productivity',
  'Content',
  'Web Automation',
  'Automation',
] as const;

// Category constants - used for both UI grouping AND requirement matching
export const MCP_CATEGORY = {
  // Core
  BUILT_IN: 'Built-in',
  FILESYSTEM: 'Filesystem',

  // Web & Browser
  BROWSER: 'Browser',

  // Context
  BUSINESS_CONTEXT: 'Business Context',

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
