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

import type { todoTemplateSchema, todoStatsSchema, TodoPackage } from './todo_registry_schema';
import type { z } from 'zod';

// =============================================================================
// TODO Template types
// =============================================================================

/** Stats for display */
export type TodoStats = z.infer<typeof todoStatsSchema>;

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
