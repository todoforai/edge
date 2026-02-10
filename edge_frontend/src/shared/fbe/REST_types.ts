import type { MessageBlock, RunMeta } from './blocks';
import { ProjectStatus, TodoStatus, AgentflowStatus } from './enums';
import type { MCPJSON, MCPToolSkeleton, AttachmentFrame, AttachmentWireCreate, InstalledMCP } from './index';
import { TransactionType } from './enums';
import type { DataType } from './context_schema';

// ============================================
// Core Model Types (used across FE/BE)
// ============================================
// Note: Attachment and AttachmentMetadata are defined in models/index.ts (storage model)
// Use AttachmentBase/AttachmentFrame/AttachmentData from edge/types for API responses

export interface User {
  id: string;
  name?: string;
  email?: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  isAnonymous?: boolean | null;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Session with associated user data. */
export interface SessionWithUser {
  user: User & Record<string, any>;
  session: Session & Record<string, any>;
}

export interface MCPEdgesSettings {
  [edgeId: string]: MCPSettings;
}
export interface MCPSettings {
  [serverId: string]: ServerSettings;
}
export interface ServerSettings {
  isActive?: boolean;
  [toolName: string]: ToolConfiguration | boolean | string[] | undefined;
}

export interface ToolConfiguration {
  isActive?: boolean;
  // env, conf, and other configurable properties can be added here
  [configKey: string]: any;
}

/** MCP server configurations for an agent. */
export interface AgentMCPConfig {
  id: string;
  agentId: string;
  /** Server name -> configuration */
  mcps: Record<string, MCPJSON>;
  updatedAt: number;
}

// Payment-related interfaces
export interface PaymentIntent {
  clientSecret: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export interface SetupIntent {
  clientSecret: string;
}

/** A saved payment method. */
export interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  isDefault: boolean;
}

export interface PaymentMethodList {
  paymentMethods: PaymentMethod[];
}

export interface FileRegistration {
  attachmentId: string;
  uri: string;
  isPublic: boolean;
  fileSize: number;
  createdAt: number;
}

/** Public statistics for a todo in the registry. */
export interface TodoStats {
  id: string;
  /** Times started/forked */
  starts: number;
  likes: number;
  /** 0-100 */
  completionRate: number;
  /** In milliseconds */
  avgCompletionTime: number;
  /** Current user has liked */
  isLiked: boolean;
}

export interface PackStats {
  id: string;
  likes: number;
  isLiked: boolean;
}

/** An API key for programmatic access. */
export interface ApiKey {
  name: string;
  /** Not the secret key itself */
  id: string;
  createdAt: number;
  isDefault: boolean;
}

/** Info for updating and starting a todo immediately. */
export interface TodoImmediateStartUpdate {
  messageId: string;
  agentSettings: AgentSettings;
  attachments?: AttachmentFrame[];
  content?: string;
  filteredEdgeTools?: Record<string, MCPToolSkeleton[]>;
}

/** Input for creating a new todo. */
export interface TodoCreateInput {
  content: string;
  agentSettings: AgentSettings;
  attachments?: AttachmentFrame[];
  scheduledTimestamp?: number;
  filteredEdgeTools?: Record<string, MCPToolSkeleton[]>;
  todoId?: string;
  allowQueue?: boolean;
  businessContextId?: string;
}

/** Input for updating todo content. */
export interface TodoContentInput {
  content?: string;
  attachments?: AttachmentFrame[];
  scheduledTimestamp?: number;
  agentSettingsId?: string;
}

export interface BillingInfo {
  companyName?: string;
  vatNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryISO?: string; // Must be ISO 3166-1 alpha-2 code
  addressValid?: boolean;
}

export interface AppSettings extends BillingInfo {
  id: string;
  theme: string;
  todoListTheme?: 'weblike' | 'terminal';
  diffControl: string;
  shellExecution: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  dataAnalytics: boolean;
  playSoundOnTaskComplete: boolean;
  showTodoCompletionToast: boolean;
  keyboardBindings?: Record<string, string>;
  keyboardShortcutsEnabled?: boolean;
  defaultViewMode?: string;
}

/** Authentication result with user and session info. */
export interface AuthResult {
  user?: User;
  session?: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

export interface UserProfile {
  id: string;
  lastProjectId: string;
  balance: number;
  stripeCustomerId?: string;
  projectIdToAgentId?: Record<string, string>;
  selectedBusinessContextId?: string;
}
/** User profile with app settings. */
export interface UserProfileFull {
  user: UserProfile;
  settings: AppSettings;
}

/** A project organizes todos and agentflows. */
export interface Project {
  id: string;
  name: string;
  description: string;
  projectSettingsId: string;
  ownerId: string;
  ownerEmail: string;
  isPublic: boolean;
  todoIds: string[];
  agentflowIds: string[];
  /** User IDs with read access */
  readAccessIds: string[];
  /** User IDs with write access */
  writeAccessIds: string[];
  readAccessEmails: string[];
  writeAccessEmails: string[];
  status: ProjectStatus;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
  deletedAt?: number;
}

export interface ProjectSettings {
  id: string;
  projectId: string;
}

/** Project with its settings. */
export interface ProjectFull {
  project: Project;
  settings: ProjectSettings;
}

/** Lightweight todo without full message content. */
export interface TodoSummary {
  id: string;
  projectId: string;
  status: TodoStatus;
  agentSettingsId: string;
  content?: string;
  messageIds: string[];
  createdAt: number;
  lastActivityAt: number;
  /** 0 if immediate */
  scheduledTimestamp: number;
}

/** Full todo with messages and metadata. */
export interface Todo {
  id: string;
  projectId: string;
  status: TodoStatus;
  agentSettingsId: string;
  /** Domain-specific knowledge context */
  businessContextId?: string;
  systemMessageId?: string;
  content: string;
  messageIds: string[];
  messages: Message[];
  /** User-checked blocks */
  checkedBlockIds?: string[];
  /** Blocks with code, commands, etc. */
  actionableBlockIds?: string[];
  createdAt: number;
  archivedAt?: number;
  deletedAt?: number;
  lastActivityAt: number;
  /** 0 if immediate */
  scheduledTimestamp: number;
  /** For optimistic concurrency */
  workflowVersion?: string;
}

/** A message in a todo conversation. */
export interface Message {
  id: string;
  todoId: string;
  content: string;
  /** 'user', 'assistant', or 'system' */
  role: string;
  agentSettingsId: string;
  /** Stop sequence that ended AI response, if any */
  stop_sequence: string;
  createdAt: number;
  /** Parsed content blocks (code, tool calls, text) */
  blocks: MessageBlock[];
  /** 0 if sent immediately */
  scheduledTimestamp: number;
  attachments: AttachmentFrame[];
  /** Token usage, model info, etc. */
  runMeta?: RunMeta[];
}

// AgentSettings types

/** Permission state for a tool or service */
export type PermissionState = 'allow' | 'ask' | 'deny';

/** Extended permission type including remembered permissions */
export type PermissionType = PermissionState | 'remembered_allow' | 'remembered_deny';

/** User's decision when approving/denying a tool execution */
export type ApprovalDecision = 'allow_once' | 'allow_remember' | 'deny_once' | 'deny_remember';

export interface ToolPermissions {
  /** Tools that auto-execute without approval */
  allow: string[];
  /** Tools that require user approval (default behavior if not in any list) */
  ask?: string[];
  /** Tools that are blocked from execution */
  deny?: string[];
  /** User-remembered allow patterns from approval dialog (e.g., "BASH(command: npm *)") */
  remembered_allow?: string[];
  /** User-remembered deny patterns from approval dialog (e.g., "BASH(command: rm *)") */
  remembered_deny?: string[];
}

/** AI AgentSettings configuration including model, system prompt, and MCP tools. */
export interface AgentSettings {
  id: string;
  name: string;
  ownerId: string;
  /** Custom system prompt for the agent */
  systemMessage?: string;
  /** LLM model identifier (e.g., 'claude-3-opus') */
  model?: string;
  /** 'default_coder' uses built-in coding prompt, 'custom_w_tools' uses systemMessage */
  systemMessageMode?: 'default_coder' | 'custom_w_tools';
  /** Auto-enhance system prompt based on context */
  smartSystemPrompt?: boolean;
  /** Cloud MCP server configurations */
  mcpConfigs: MCPSettings;
  /** Edge device MCP configurations by edgeId */
  edgesMcpConfigs: MCPEdgesSettings;
  /** Tool permission allowlist */
  permissions?: ToolPermissions;
  /** Template this agent was created from */
  templateId?: string;
  createdAt: number;
  updatedAt: number;
}
export type AgentSettingsUpdate = Omit<AgentSettings, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;

/** Fields for updating an edge. */
export interface EdgeUpdateFields {
  name?: string;
  workspacepaths?: string[];
  installedMCPs?: Record<string, InstalledMCP>;
  isShellEnabled?: boolean;
  isFileSystemEnabled?: boolean;
}

// Task types
export interface Task {
  id: string;
  type: 'TASK_NEW' | 'CODE_EXECUTE' | 'FILE_SAVE' | 'DIR_LIST' | 'INSTANT_APPLY' | 'INSTANT_DIFF' | 'USER_TODO';
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED';
  input?: string;
  createdAt: number;
  error?: string;
}

export interface UserBalance {
  balance: number;
}

// ============================================
// Subscription Types
// ============================================

import type { SubscriptionTier, SubscriptionStatus, BillingInterval, SubscriptionPlan } from './billing';

/** Current subscription status for a user */
export interface SubscriptionInfo {
  subscriptionId: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus | null;
  currentPeriodEnd: number | null;
  usageThisMonth: number;
  usageLimit: number | null;
  billingCycleStart: number | null;
}

/** Input for creating a subscription */
export interface CreateSubscriptionInput {
  tier: Exclude<SubscriptionTier, 'none'>;
  interval: BillingInterval;
}

/** Input for updating a subscription */
export interface UpdateSubscriptionInput {
  newTier: Exclude<SubscriptionTier, 'none'>;
  interval?: BillingInterval;
}

/** Input for canceling a subscription */
export interface CancelSubscriptionInput {
  cancelAtPeriodEnd: boolean;
}

/** Result of a subscription operation */
export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  clientSecret?: string;  // For Stripe Elements payment
  checkoutUrl?: string;   // For Stripe Checkout redirect
  message?: string;
}

/** Usage status showing current usage vs limit */
export interface UsageStatus {
  usageThisMonth: number;
  usageLimit: number | null;
  percentUsed: number | null;  // 0-100, null if unlimited
  isNearLimit: boolean;  // true if >= 80%
  isAtLimit: boolean;    // true if >= 100%
  tier: SubscriptionTier;
}

/** Available subscription plans response */
export interface SubscriptionPlansResponse {
  plans: SubscriptionPlan[];
}

/** Extended project settings with LLM config and preferences. */
export interface ProjectSettingsFull {
  id: string;
  projectId: string;
  llmModel?: string;
  llmConfig?: Record<string, any>;
  workspacePaths?: string[];
  skills?: Record<string, any>;
  diff?: string;
  preferences?: Record<string, any>;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  totalAmount?: number;
  description: string;
  source?: string;
  createdAt: number;
}

export interface TransactionPage {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Agentflow types
/** Fields for updating an agentflow (without agentflowId). */
export interface AgentflowUpdateFields {
  name?: string;
  description?: string;
  status?: AgentflowStatus;
  triggerMCP?: string;
  agentSettingsId?: string;
}

/** An automated workflow triggered by MCP events. */
export interface Agentflow {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  agentSettingsId: string;
  ownerId: string;
  status: AgentflowStatus;
  /** MCP server that triggers this flow */
  triggerMCP?: string;
  /** Todos created by this flow */
  todoIds: string[];
  createdAt: number;
  updatedAt: number;
}

/** Workflow metadata for a todo. */
export interface TodoWorkflow {
  workflowMeta: string | null;
  workflowVersion: string | null;
  /** The most recent context summary (if any compaction occurred) */
  lastContextSummary?: ContextSummary | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  stripeInvoiceId?: string;
  stripeInvoiceUrl?: string;
  totalAmount: number;
  currency: string;
  status: string;
  dueDate: number;
  paidDate?: number;
  items: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DailyUsage {
  dayTS: number;
  totalSpent: number;
  totalAdded: number;
  messageCount: number;
  mcpUsageCount: number;
  modelUsage: Record<string, { inputTokens: number; outputTokens: number; cost: number }>;
  updatedAt: number;
}

export interface Usage {
  dailyUsages: DailyUsage[];
}

// ============================================
// Context Tracking Types
// ============================================

/** Token breakdown for context tracking */
export interface ContextTokenBreakdown {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** Represents a context compaction event - when old messages are summarized */
export interface ContextSummary {
  /** Token count after compaction */
  outputTokens: number;
  /** When compaction happened */
  timestamp: number;
  /** Which messages were summarized */
  messageIds: string[];
  /** The summary as an attachment frame, ready to be attached to a message */
  summaryAttachment?: AttachmentFrame;
  /** Status: 'ready' = waiting to be used, 'used' = already attached to a message */
  status?: 'ready' | 'used';
}

/** Context usage information for a conversation/todo */
export interface ContextInfo {
  /** The todo ID this context info belongs to */
  todoId: string;
  /** The model being used */
  model: string;
  /** Maximum context window size in tokens */
  contextWindow: number;
  /** Current tokens used */
  usedTokens: number;
  /** Percentage of context window used (0-100) */
  utilizationPercent: number;
  /** Number of messages in the conversation */
  messageCount: number;
  /** Whether context compaction is recommended */
  shouldCompact: boolean;
  /** Warning level based on utilization */
  warningLevel: 'normal' | 'warning' | 'critical';
  /** Detailed token breakdown */
  breakdown: ContextTokenBreakdown;
}

/** Input for getting context info */
export interface ContextInfoInput {
  todoId: string;
  model?: string;
}

/** Available model with its context window */
export interface ModelContextInfo {
  name: string;
  contextWindow: number;
}

/** List of available models */
export interface AvailableModels {
  models: ModelContextInfo[];
}

/** Input for context compaction */
export interface CompactInput {
  todoId: string;
  /** If true, only simulate compaction without making changes */
  dryRun?: boolean;
  /** Target utilization percentage after compaction (0-1, default 0.5 = 50%) */
  targetUtilization?: number;
}

/** Result of a context compaction operation */
export interface CompactResult {
  success: boolean;
  originalTokens: number;
  compactedTokens: number;
  savedTokens: number;
  summary?: string;
  message?: string;
}

/** Input for adding a context summary */
export interface AddContextSummaryInput {
  todoId: string;
  /** Token count after compaction */
  outputTokens: number;
  /** When compaction happened */
  timestamp: number;
  /** Which messages were summarized */
  messageIds: string[];
  /** The summary as an attachment frame */
  summaryAttachment?: AttachmentFrame;
  /** Status: 'ready' = waiting to be used, defaults to 'ready' */
  status?: 'ready' | 'used';
}

// ============================================
// Common Input Types (used by tRPC and REST)
// ============================================

export interface EmptyInput {}

export interface SuccessResponse {
  success: boolean;
}

export type VoidOutput = null;

export interface IdInput {
  id: string;
}

export interface ProjectIdInput {
  projectId: string;
}

/**
 * Input for identifying a specific todo item.
 */
export interface TodoIdInput {
  /**
   * The unique identifier of the todo item.
   * @example "todo_abc123xyz"
   */
  todoId: string;
}

export interface AgentIdInput {
  agentSettingsId: string;
}

export interface AgentflowIdInput {
  agentflowId: string;
}

export interface EdgeIdInput {
  edgeId: string;
}

export interface AttachmentIdInput {
  attachmentId: string;
}

export interface ContextIdInput {
  id: string;
}

// Project Input Types
export interface ProjectCreateInput {
  name: string;
  description?: string;
  isPublic: boolean;
}

export interface ProjectUpdateInput {
  projectId: string;
  name?: string;
  description?: string;
  isPublic?: boolean;
  status?: ProjectStatus;
}

export interface ShareProjectInputBase {
  projectId: string;
  email: string;
  canWrite: boolean;
}

/** Input for selecting/assigning an agent to a project. */
export interface ProjectAgentSelectionInput {
  projectId: string;
  agentSettingsId: string;
}

// Todo Input Types
export interface TodoMessageIdInput {
  todoId: string;
  messageId: string;
}

export interface TodoBlockIdInput {
  todoId: string;
  blockId: string;
}

/**
 * Input for updating a todo's properties.
 */
export interface TodoUpdateInput {
  /** The unique identifier of the todo to update */
  todoId: string;
  /** New content/prompt for the todo */
  content?: string;
  /** Unix timestamp to schedule the todo (0 or omit for immediate) */
  scheduledTimestamp?: number;
  /** ID of the agent settings to use for processing */
  agentSettingsId?: string;
}

/**
 * Input for updating a todo's status.
 * Use this to pause, resume, complete, or cancel a running todo.
 */
export interface TodoStatusUpdateInput {
  /** The unique identifier of the todo to update */
  todoId: string;
  /**
   * The new status to set. Valid values: 'idle', 'running', 'paused', 'completed', 'failed'
   * @example "completed"
   */
  status: TodoStatus;
}

export interface AddMessageInput {
  todoId: string;
  projectId: string;
  content: string;
  agentSettings: AgentSettings;
  /** Raw attachments to register (from agent). Will be converted to AttachmentFrame[]. */
  attachments?: AttachmentWireCreate[];
  scheduledTimestamp?: number;
  filteredEdgeTools?: Record<string, MCPToolSkeleton[]>;
  afterMessageId?: string;
  businessContextId?: string;
}

export interface UpdateMessageInput {
  todoId: string;
  messageId: string;
  content?: string;
  attachments?: AttachmentFrame[];
  scheduledTimestamp?: number;
  agentSettingsId: string;
  filteredEdgeTools?: Record<string, MCPToolSkeleton[]>;
}

export interface UpdateAndStartMessageInput {
  todoId: string;
  messageId: string;
  content?: string;
  attachments?: AttachmentFrame[];
  agentSettings: AgentSettings;
  filteredEdgeTools?: Record<string, MCPToolSkeleton[]>;
}

/** Input for selecting/assigning an agent to a todo. */
export interface TodoAgentSelectionInput {
  todoId: string;
  agentSettingsId: string;
}

export interface WorkflowUpdateInput {
  todoId: string;
  workflowMeta: string;
  workflowVersion: string;
  /** Set to true to mark the pending context summary as 'used' */
  contextSummaryUsed?: boolean;
}

// Agent Input Types
export interface AgentFieldsInput {
  agentSettingsId: string;
  name?: string;
  systemMessage?: string;
  model?: string;
  systemMessageMode?: 'default_coder' | 'custom_w_tools';
  smartSystemPrompt?: boolean;
  mcpConfigs?: MCPSettings;
  edgesMcpConfigs?: MCPEdgesSettings;
  permissions?: ToolPermissions;
  templateId?: string;
  updatedAt?: number;
}

export interface AgentReorderInput {
  agentSettingsIds: string[];
}

export interface AgentUpdateInput {
  agentSettingsId: string;
  updates: Partial<AgentSettingsUpdate>;
}

export interface AgentMCPInput {
  agentSettingsId: string;
  mcpName: string;
  config: ServerSettings;
}

export interface AgentEdgeMCPInput {
  agentSettingsId: string;
  edgeId: string;
  mcpName: string;
  config: ServerSettings;
}

// Agentflow Input Types
export interface AgentflowCreateInput {
  name: string;
  description?: string;
  agentSettingsId: string;
  triggerMCP?: string;
}

export interface AgentflowUpdateInput {
  agentflowId: string;
  name?: string;
  description?: string;
  status?: AgentflowStatus;
  triggerMCP?: string;
}

export interface AgentflowTodoInput {
  agentflowId: string;
  todoId: string;
}

export interface AgentflowCreateFullInput extends AgentflowCreateInput {
  projectId: string;
}

export interface AgentflowUpdateFullInput extends AgentflowUpdateFields {
  agentflowId: string;
}

// Billing Input Types
export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface InvoicesInput {
  limit?: number;
  cursor?: string;
}

export interface PaymentIntentInput {
  amount: number;
  paymentMethodId?: string;
}

export interface PaymentMethodIdInput {
  paymentMethodId: string;
}

export interface BillingInfoInput {
  companyName?: string;
  vatNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryISO?: string;
  addressValid?: boolean;
}

export interface ProjectSettingsUpdateInput {
  projectId: string;
  settings: Record<string, unknown>;
}

export interface UserSettingsUpdateInput {
  settings: Partial<Omit<AppSettings, 'id'>>;
}

// Edge Input Types
export interface EdgeUpdateInput {
  edgeId: string;
  updates: EdgeUpdateFields;
}

// API Key Input Types
export interface ApiKeyNameInput {
  name: string;
}

// Usage Input Types
export interface UsageQueryInput {
  startDate?: string;
  endDate?: string;
}

// MCP Input Types
export interface MCPUpdateInput {
  agentId: string;
  mcpData: Record<string, MCPJSON>;
}

// Business Context Types
/** Domain-specific knowledge context for AI agents. */
export interface BusinessContext {
  id: string;
  userId: string;
  name: string;
  tagline: string;
  itemIds: string[];
  createdAt: number;
  updatedAt: number;
}

/** A knowledge item within a business context. */
export interface BusinessContextItem {
  id: string;
  /** Template type identifier */
  template: string;
  label: string;
  icon: string;
  enabled: boolean;
  /** Structured data for this item */
  data: DataType;
  updatedAt: number;
}

// Business Context Input Types
export interface BusinessContextCreateInput {
  name: string;
  tagline?: string;
  initialItems?: BusinessContextItemInput[];
}

export interface BusinessContextItemIdInput {
  id: string;
  itemId: string;
}

export interface BusinessContextItemInput {
  template: string;
  label: string;
  icon: string;
  enabled: boolean;
  data: DataType;
}

export interface BusinessContextItemUpdateInput {
  label?: string;
  icon?: string;
  enabled?: boolean;
  data?: DataType;
}

export interface SetSelectedContextInput {
  contextId: string | null;
}

export interface BusinessContextUpdateInput {
  id: string;
  name?: string;
  tagline?: string;
}

export interface BusinessContextAddItemInput {
  id: string;
  item: BusinessContextItemInput;
}

export interface BusinessContextUpdateItemInput {
  id: string;
  itemId: string;
  updates: BusinessContextItemUpdateInput;
}

// Attachment Input Types
export interface AttachmentByTodoInput {
  todoId: string;
  limit?: number;
  offset?: number;
}

export interface AttachmentByAgentInput {
  agentSettingsId: string;
  limit?: number;
  offset?: number;
}

export interface AttachmentByUserInput {
  userId: string;
  limit?: number;
  offset?: number;
}

// Admin Input Types
export interface AdminEmailInputBase {
  email: string;
}

// Challenge Input Types
export interface ChallengeCreateInputBase {
  challenge: string;
  email?: string;
}

// Task Types
export interface PendingTask {
  id: string;
  type: string;
  content?: string;
  createdAt: number;
}

// Additional Output Types
/** Result of validating an API key. */
export interface ApiKeyValidation {
  valid: boolean;
  error: string | null;
  userId?: string;
}

/** Paginated list of invoices. */
export interface InvoicesPage {
  invoices: Invoice[];
  hasMore: boolean;
  nextCursor?: string;
}

/** Result of updating billing info. */
export interface BillingUpdateResult {
  success: boolean;
  addressValid?: boolean;
  message?: string;
}

/** A verification challenge. */
export interface Challenge {
  id: string;
  challenge: string;
  email?: string;
  createdAt: Date;
}

/** User info for admin views. */
export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  isAnonymous: boolean;
}
