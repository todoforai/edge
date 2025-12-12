import { AgentSettingsResponse } from '@/external_shared/REST_types';
import { MCPCategoryType, MCP_CATEGORY } from '@/todo-registry/constants';
import todoRegistryData from '@/assets/todo-registry.json';
import { BUILT_IN_CLOUD_TOOLS } from '@/constants/builtInMcpTools';

/**
 * MCP requirement type
 */
export type MCPRequirementType = 'REGISTRY_ID' | 'CATEGORY';

/**
 * Tool configuration in requirements
 */
export interface RequiredToolConfig {
  isActive?: boolean;
  autoRun?: boolean;
  description?: string;
}

/**
 * MCP requirement specification for a TODO
 */
export interface MCPRequirement {
  /** Type of requirement */
  type: MCPRequirementType;

  /** Registry ID if type is REGISTRY_ID (e.g., 'gmail', 'github') */
  registryId?: string;

  /** Category if type is CATEGORY (e.g., 'Browser', 'Email') */
  category?: MCPCategoryType;

  /** Required tools with their configurations */
  requiredTools?: Record<string, RequiredToolConfig>;

  /** Whether this MCP is optional or required */
  optional?: boolean;

  /** Environment variables that need to be configured */
  requiredEnvVars?: string[];
}

export const TODOAI_CLOUD_REGISTRY_ID = 'todoai_cloud';

/**
 * Requirement targets todoai_cloud registry with required tools
 */
export const isTodoaiCloudRegistryRequirement = (req: MCPRequirement): boolean =>
  req.type === 'REGISTRY_ID' && req.registryId === TODOAI_CLOUD_REGISTRY_ID && !!req.requiredTools;

/**
 * Build prefilled MCP configs for todoai_cloud:
 * - Activate registry
 * - Enable exactly the required tools (with provided flags)
 * - Explicitly disable built-in defaultActive tools not required
 */
export const getPrefilledMcpConfigs = (template: TodoTemplate): AgentSettingsResponse['mcpConfigs'] => {
  const base = { ...template.agentSettings.mcpConfigs };

  for (const req of template.mcpRequirements) {
    if (isTodoaiCloudRegistryRequirement(req)) {
      const registryId = req.registryId as string;
      const requiredTools = req.requiredTools || {};
      const toolConfigs: Record<string, { isActive?: boolean; autoRun?: boolean }> = {};

      // Set required tools from requirements
      for (const [toolName, toolConfig] of Object.entries(requiredTools)) {
        const toolEntry: { isActive?: boolean; autoRun?: boolean } = {};
        if (toolConfig.isActive !== undefined) toolEntry.isActive = toolConfig.isActive;
        if (toolConfig.autoRun !== undefined) toolEntry.autoRun = toolConfig.autoRun;
        toolConfigs[toolName] = toolEntry;
      }

      // Disable defaultActive tools not in requirements
      const cloudToolsDef = BUILT_IN_CLOUD_TOOLS[registryId];
      if (cloudToolsDef) {
        for (const tool of cloudToolsDef.tools) {
          if (tool.defaultActive && !(tool.name in requiredTools)) {
            toolConfigs[tool.name] = { isActive: false };
          }
        }
      }

      base[registryId] = { isActive: true, ...toolConfigs };
    }

    // Auto-enable CATEGORY requirements if only one cloud tool matches
    if (req.type === 'CATEGORY' && req.category) {
      const matchingTools: { registryId: string; toolName: string }[] = [];
      for (const [registryId, service] of Object.entries(BUILT_IN_CLOUD_TOOLS)) {
        for (const tool of service.tools) {
          if (tool.category === req.category) {
            matchingTools.push({ registryId, toolName: tool.name });
          }
        }
      }
      // Only auto-enable if exactly one option exists
      if (matchingTools.length === 1) {
        const { registryId, toolName } = matchingTools[0];
        base[registryId] = { ...base[registryId], isActive: true, [toolName]: { isActive: true } };
      }
    }
  }

  return base;
};

/**
 * Input field type for TODO templates
 */
export type TodoInputType = 'text' | 'number' | 'textarea';

/**
 * Input field configuration for TODO templates
 */
export interface TodoInput {
  /** Unique identifier for this input */
  id: string;

  /** Display label */
  label: string;

  /** Input type */
  type: TodoInputType;

  /** Placeholder text */
  placeholder?: string;

  /** Default value */
  default?: string | number;

  /** Help text */
  helpText?: string;

  /** Whether this input is required */
  required?: boolean;
}

/**
 * TODO card metadata for registry display
 */
export interface TodoCardMetadata {
  /** Unique identifier for the TODO template */
  id: string;

  /** Display name */
  todoname: string;

  /** Short description */
  description: string;

  /** Detailed description with markdown support */
  longDescription?: string;

  /** Target URLs for the TODO (used to fetch OG images) */
  targetUrls?: string[];

  /** Category tags */
  categories: string[];

  /** Creator information */
  creator: {
    name: string;
    avatar?: string;
  };

  /** Usage statistics */
  stats: {
    downloads: number;
    rating: number;
    remixes: number;
    completionRate?: number; // 0-100
    avgCompletionTime?: number; // minutes
    activeUsers?: number;
  };

  /** MCP requirements */
  mcpRequirements: MCPRequirement[];

  /** Dynamic input fields for the TODO */
  inputs?: TodoInput[];

  /** Whether this is a featured TODO */
  featured?: boolean;

  /** Creation date */
  createdAt: number;

  /** Last update date */
  updatedAt: number;
}

/**
 * Full TODO template that can be imported
 */
export interface TodoTemplate extends TodoCardMetadata {
  /** Base TODO settings (without IDs and owner info) */
  agentSettings: Omit<AgentSettingsResponse, 'id' | 'ownerId' | 'createdAt' | 'updatedAt' | 'templateId'>;
}

/**
 * Stats map - temporary hardcoded solution until backend provides this
 */
export const todoId2Stats: Record<string, { downloads: number; rating: number; remixes: number }> = {
  'theresanaiforthat-submission': { downloads: 2150, rating: 412, remixes: 0 },
  'email-automation-specialist': { downloads: 11256, rating: 1876, remixes: 89 },
  'marketing-image-generator': { downloads: 450, rating: 87, remixes: 12 },
  'producthunt-company-registration': { downloads: 5340, rating: 892, remixes: 0 },
  'coding-assistant-pro': { downloads: 12936, rating: 2156, remixes: 156 },
  'local-coder-001': { downloads: 15420, rating: 3247, remixes: 234 },
};

const defaultStats = { downloads: 0, rating: 0, remixes: 0 };

const testFullRequirementsTODOTemplate: TodoTemplate = {
  id: 'full-test-todo',
  todoname: 'Full Test TODO',
  description: 'Test TODO with all MCP requirements: browser, filesystem, todoai central + edge tools',
  categories: ['Development', 'Web Automation', 'Productivity'],
  featured: false,
  creator: { name: 'TODO for AI', avatar: '/T-rocket-middle.svg' },
  stats: { downloads: 0, rating: 0, remixes: 0 },
  mcpRequirements: [
    // Browser automation (use MCP_CATEGORY value, not key)
    {
      type: 'CATEGORY',
      category: MCP_CATEGORY.BROWSER, // 'Browser'
      requiredTools: {
        navigate: { isActive: true, autoRun: true },
        click: { isActive: true, autoRun: true },
        screenshot: { isActive: true, autoRun: true },
        type: { isActive: true, autoRun: true },
      },
    },
    // TodoAI cloud tools
    {
      type: 'REGISTRY_ID',
      registryId: 'todoai_cloud',
      requiredTools: {
        image_gen: { isActive: true },
        web_content: {},
        google_rag: { isActive: true },
      },
    },
    // TodoAI edge tools
    {
      type: 'REGISTRY_ID',
      registryId: 'todoai_edge',
      requiredTools: {
        files: { isActive: true, autoRun: true },
        modify: { isActive: true, autoRun: true },
        shell: {},
        download: { isActive: true },
      },
    },
  ],
  agentSettings: {
    name: 'Full Test TODO',
    systemMessage:
      'You are a full-stack AI assistant with access to:\n' +
      '- Browser automation (navigate, click, type, screenshot)\n' +
      '- Filesystem operations (read, write, list)\n' +
      '- Image generation\n' +
      '- Web content extraction\n' +
      '- Google search\n' +
      '- Local file operations (create, modify, shell, download)\n\n' +
      'Use the appropriate tools for each task.',
    mcpConfigs: {},
    edgesMcpConfigs: {},
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
/**
 * TODO templates loaded from JSON registry, merged with stats.
 */
export const DUMMY_TODO_TEMPLATES: TodoTemplate[] = [
  ...Object.values(todoRegistryData as unknown as Record<string, Omit<TodoTemplate, 'stats'>>).map((data) => ({
    ...data,
    stats: todoId2Stats[data.id] ?? defaultStats,
  })),
  // Example: comprehensive TODO template testing ALL requirements
  testFullRequirementsTODOTemplate,
];

/**
 * Get TODO template by ID
 */
export function getTODOTemplateById(id: string): TodoTemplate | undefined {
  return DUMMY_TODO_TEMPLATES.find((template) => template.id === id);
}

/**
 * Filter TODO templates by category
 */
export function filterTODOTemplatesByCategory(category: string): TodoTemplate[] {
  if (category === 'All') return DUMMY_TODO_TEMPLATES;
  return DUMMY_TODO_TEMPLATES.filter((template) => template.categories.includes(category));
}

/**
 * Get featured TODO templates
 */
export function getFeaturedTODOTemplates(): TodoTemplate[] {
  return DUMMY_TODO_TEMPLATES.filter((template) => template.featured);
}

/**
 * Convert todo template to importable agent settings
 * Appends user-provided inputs to system message if provided
 */
export function templateToAgentSettings(
  template: TodoTemplate,
  userId: string,
  inputValues?: Record<string, string | number>
): Omit<AgentSettingsResponse, 'id' | 'createdAt' | 'updatedAt'> {
  let systemMessage = template.agentSettings.systemMessage;

  // Append input values if provided
  if (inputValues && Object.keys(inputValues).length > 0 && template.inputs) {
    const inputLines = template.inputs
      .filter((input) => inputValues[input.id] !== undefined && inputValues[input.id] !== '')
      .map((input) => `${input.label}: ${inputValues[input.id]}`)
      .join('\n');

    if (inputLines) {
      systemMessage = `${systemMessage}

---
User Context:
${inputLines}`;
    }
  }

  const mcpConfigs = getPrefilledMcpConfigs(template);

  return {
    ...template.agentSettings,
    name: template.todoname,
    mcpConfigs,
    systemMessage,
    ownerId: userId,
    templateId: template.id,
  };
}

/**
 * Search TODO templates by query
 */
export function searchTODOTemplates(query: string): TodoTemplate[] {
  if (!query.trim()) return DUMMY_TODO_TEMPLATES;

  const lowerQuery = query.toLowerCase();
  return DUMMY_TODO_TEMPLATES.filter(
    (template) =>
      template.todoname.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.categories.some((cat) => cat.toLowerCase().includes(lowerQuery)) ||
      template.mcpRequirements.some(
        (req) => req.registryId?.toLowerCase().includes(lowerQuery) || req.category?.toLowerCase().includes(lowerQuery)
      )
  );
}
