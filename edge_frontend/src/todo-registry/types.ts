import { MCPCategoryType } from './constants';

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
 * Base TODO template agent settings (generic, no frontend-specific types)
 */
export interface TodoTemplateAgentSettings {
  name: string;
  systemMessage: string;
  mcpConfigs: Record<string, unknown>;
  edgesMcpConfigs?: Record<string, unknown>;
}

/**
 * Full TODO template that can be imported
 */
export interface TodoTemplate extends TodoCardMetadata {
  /** Base TODO settings */
  agentSettings: TodoTemplateAgentSettings;
}

/**
 * Raw TodoPack data from JSON (without id, since id is the key)
 */
export interface TodoPackData {
  /** Display name */
  name: string;

  /** Short description */
  description: string;

  /** Detailed description with markdown support */
  longDescription?: string;

  /** Target URLs - first one used as primary for OG image + hostname display */
  targetUrls: string[];

  /** Category tags */
  categories?: string[];

  /** IDs of TODO templates included in this pack */
  todoIds: string[];

  /** Creator info */
  creator: {
    name: string;
    avatar?: string;
  };

  /** Usage statistics */
  stats?: {
    completionRate: number;
    avgCompletionTime: number;
    activeUsers: number;
  };

  /** Whether this is a featured pack */
  featured?: boolean;

  /** Estimated time to complete all TODOs (in minutes) */
  estimatedTime?: number;

  /** Difficulty level */
  difficulty?: 'beginner' | 'intermediate' | 'advanced';

  /** Creation date */
  createdAt: number;

  /** Last update date */
  updatedAt: number;
}

/**
 * TodoPack - includes id in data
 */
export interface TodoPack extends TodoPackData {
  id: string;
}

