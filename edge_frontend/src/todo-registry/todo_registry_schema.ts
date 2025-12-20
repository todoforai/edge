import { z } from 'zod';
import { MCP_CATEGORY } from './constants';

// Valid category keys from MCP_CATEGORY
const MCP_CATEGORY_KEYS = Object.keys(MCP_CATEGORY) as [string, ...string[]];

// Type aliases for requirement type
export type MCPRequirementType = 'REGISTRY_ID' | 'CATEGORY';
export type TodoInputType = 'text' | 'number' | 'textarea';

// Base schemas
export const requiredToolConfigSchema = z.object({
  isActive: z.boolean().optional(),
  autoRun: z.boolean().optional(),
  description: z.string().optional(),
});

export const mcpRequirementSchema = z.object({
  type: z.enum(['CATEGORY', 'REGISTRY_ID']),
  category: z.enum(MCP_CATEGORY_KEYS).optional(),
  registryId: z.string().optional(),
  optional: z.boolean().optional(),
  requiredTools: z.record(z.string(), requiredToolConfigSchema).optional(),
  requiredEnvVars: z.array(z.string()).optional(),
});

export const todoInputSchema = z.object({
  label: z.string(),
  type: z.enum(['text', 'textarea', 'number'] as [TodoInputType, ...TodoInputType[]]),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean().optional(),
  default: z.union([z.string(), z.number()]).optional(),
});

export const todoAgentSettingsSchema = z.object({
  systemMessage: z.string(),
}).strict();

export const todoCreatorSchema = z.object({
  name: z.string(),
  avatar: z.string().optional(),
});

export const todoSchema = z.object({
  todoname: z.string().max(35),
  description: z.string(),
  targetUrls: z.array(z.string()).optional(),
  categories: z.array(z.string()),
  featured: z.boolean().optional(),
  creator: todoCreatorSchema,
  mcpRequirements: z.array(mcpRequirementSchema).optional(),
  inputs: z.array(todoInputSchema).optional(),
  agentSettings: todoAgentSettingsSchema,
});

export const todoStatsSchema = z.object({
  downloads: z.number(),
  likes: z.number(),
  completionRate: z.number(),
  avgCompletionTime: z.number(),
});


export const packageSchema = z.object({
  name: z.string(),
  description: z.string(),
  targetUrls: z.array(z.string()),
  categories: z.array(z.string()).optional(),
  todoIds: z.array(z.string()),
  creator: todoCreatorSchema,
  featured: z.boolean().optional(),
});

// Inferred types from schemas
export type RequiredToolConfig = z.infer<typeof requiredToolConfigSchema>;
export type MCPRequirement = z.infer<typeof mcpRequirementSchema>;
export type TodoInput = z.infer<typeof todoInputSchema>;
export type TodoAgentSettings = z.infer<typeof todoAgentSettingsSchema>;
export type TodoCreator = z.infer<typeof todoCreatorSchema>;
export type Todo = z.infer<typeof todoSchema>;
export type TodoPackage = z.infer<typeof packageSchema>;

