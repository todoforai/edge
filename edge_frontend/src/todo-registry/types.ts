// =============================================================================
// Base types (re-exported from schema)
// =============================================================================
export type {
  MCPRequirementType,
  RequiredToolConfig,
  MCPRequirement,
  TodoCreator,
  TodoAgentSettings,
  Todo,
  TodoPackage,
} from './todo_registry_schema';

import { todoStatsSchema, todoSchema, type TodoPackage } from './todo_registry_schema';
import { z } from 'zod';

// =============================================================================
// TODO Template types
// =============================================================================

/** Stats for display */
export type TodoStats = z.infer<typeof todoStatsSchema>;

/** Schema for raw JSON entries (stats added at runtime) */
export const todoTemplateSchema = todoSchema.extend({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  stats: todoStatsSchema.optional(),
});
/** TODO template from registry - raw has optional stats, with stats required after addStats */
export type TodoTemplate = z.infer<typeof todoTemplateSchema>;

// =============================================================================
// TODO Pack types
// =============================================================================
/** TodoPack - includes id in data */
export interface TodoPack extends TodoPackage {
  id: string;
  createdAt: number;
  updatedAt: number;
}
