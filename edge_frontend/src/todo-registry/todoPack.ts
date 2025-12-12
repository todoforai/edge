import { TodoTemplate, getTODOTemplateById } from './todoRegistry';
import todoPackRegistryData from '@/assets/todopack-registry.json';

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

const defaultStats = { completionRate: 0, avgCompletionTime: 0, activeUsers: 0 };

/**
 * Load TodoPacks from JSON registry
 */
export const TODO_PACKS: TodoPack[] = Object.values(
  todoPackRegistryData as Record<string, TodoPack>
).map((data) => ({
  ...data,
  categories: data.categories ?? [],
  stats: data.stats ?? defaultStats,
}));

/**
 * Get resolved TODOs for a pack
 */
export function getPackTodos(pack: TodoPack): TodoTemplate[] {
  return pack.todoIds
    .map((id) => getTODOTemplateById(id))
    .filter((t): t is TodoTemplate => t !== undefined);
}

/**
 * Get TodoPack by ID
 */
export function getTodoPackById(id: string): TodoPack | undefined {
  return TODO_PACKS.find((pack) => pack.id === id);
}

/**
 * Filter TodoPacks by category
 */
export function filterTodoPacksByCategory(category: string): TodoPack[] {
  if (category === 'All') return TODO_PACKS;
  return TODO_PACKS.filter((pack) => pack.categories?.includes(category));
}

/**
 * Get featured TodoPacks
 */
export function getFeaturedTodoPacks(): TodoPack[] {
  return TODO_PACKS.filter((pack) => pack.featured);
}

/**
 * Search TodoPacks by query
 */
export function searchTodoPacks(query: string): TodoPack[] {
  if (!query.trim()) return TODO_PACKS;

  const lowerQuery = query.toLowerCase();
  return TODO_PACKS.filter(
    (pack) =>
      pack.name.toLowerCase().includes(lowerQuery) ||
      pack.description.toLowerCase().includes(lowerQuery) ||
      pack.categories?.some((cat) => cat.toLowerCase().includes(lowerQuery))
  );
}
