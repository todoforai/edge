// Shared frontend/edge components and utilities

// Re-export shared types for convenience
export type { FilterState, MCPViewMode } from '@shared/fbe';

// MCP Registry data
export * from './data/mcpServersRegistry';

// UI Components
export * from './components/ui';

// Dashboard Components
export * from './components/dashboard';

// Utilities
export { cn } from './lib/utils';
