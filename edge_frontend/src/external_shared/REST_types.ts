import type { MessageBlock, RunMeta } from './blocks';
import { ProjectStatus, TodoStatus, AgentflowStatus } from './enums';
import type { EdgeData, MCPJSON, MCPToolSkeleton, AttachmentFrame, AttachmentData } from '../edge/types';
import { TransactionType } from './enums';

export interface User {
  id: string;
  name?: string;
  email?: string;
  emailVerified: boolean;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
  isAnonymous: boolean;
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

export interface NewSession {
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
  [toolName: string]: ToolConfiguration | boolean | undefined;
}

export interface ToolConfiguration {
  isActive?: boolean;
  searchRAG?: {
    strength: 'OFF' | 'CHEAP' | 'EFFICIENT' | 'EXPENSIVE' | 'ALL';
  };
  // env, conf, and other configurable properties can be added here
  [configKey: string]: any;
}

export interface MCPResponse {
  id: string;
  agentId: string;
  mcps: Record<string, MCPJSON>;
  updatedAt: number;
}

export interface PaymentIntentRequest {
  amount: number;
  paymentMethodId?: string;
}
// Payment-related interfaces
export interface PaymentIntentResponse {
  clientSecret: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export interface SetupIntentResponse {
  clientSecret: string;
}

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

export interface PaymentMethodsResponse {
  paymentMethods: PaymentMethod[];
}

export interface PaymentMethodReq {
  paymentMethodId: string;
}

export interface RegisterFileRequest {
  blockId: string;
  base64Content: string;
  originalName: string;
  mimeType: string;
  metadata: {};
}

export interface RegisterFileResponse {
  attachmentId: string;
  uri: string;
  isPublic: boolean;
  fileSize: number;
  createdAt: number;
  // warning?: string;       // Optional: 'File content was truncated during upload'
  // fieldWarning?: string;  // Optional: 'Field name was truncated during upload'
}

// Todo Registry Stats
export interface TodoStatsResponse {
  id: string;
  starts: number;
  likes: number;
  completionRate: number;
  avgCompletionTime: number;
  isLiked: boolean;
}

export interface PackStatsResponse {
  id: string;
  likes: number;
  isLiked: boolean;
}

export interface PaymentMethodsResponse {
  paymentMethods: PaymentMethod[];
}

export interface PaymentMethodReq {
  paymentMethodId: string;
}



export interface AgentSkills {
  shell: boolean;
  files: boolean;
  modify: boolean;
  email: boolean;
  gmail: boolean;
  web: boolean;
  service: boolean;
  slack: boolean;
}

// API Key types
export interface ApiKeyResponse {
  name: string;
  id: string;
  createdAt: number;
  isDefault: boolean;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
  fingerprint: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  tempUserId?: string;
  fingerprint: string;
}

export interface TodoIdParam {
  todoId: string;
}

export interface TodoStartImmediately {
  messageId: string;
  agentSettingsId: string;
}

export interface TodoUpdateStartImmediately {
  messageId: string;
  agentSettings: AgentSettingsResponse;
  attachments?: AttachmentFrame[];
  content?: string;
  filteredEdgeTools?: Record<string, MCPToolSkeleton[]>;
}

export interface TodoBodyListening {
  content: string;
  agentSettings: AgentSettingsResponse;
  attachments: AttachmentData[];
  scheduledTimestamp?: number;
  filteredEdgeTools?: Record<string, MCPToolSkeleton[]>;
  todoId?: string; // Add optional todoId field
  allowQueue?: boolean; // Add this field
  businessContextId?: string;
}

export interface TodoStatusBody {
  status: TodoStatus;
  messageId?: string;
}
export interface TodoContentBody {
  todoId: string;
  projectId: string;
  content: string;
  role: string;
  agentSettings: AgentSettingsResponse;
  attachments: AttachmentData[];
  scheduledTimestamp?: number;
  filteredEdgeTools?: Record<string, MCPToolSkeleton[]>;
  afterMessageId?: string;
  businessContextId?: string;
}
export interface TodoUpdateContent {
  content?: string;
  attachments?: AttachmentFrame[];
  scheduledTimestamp?: number;
  agentSettingsId?: string;
  agentSettings?: AgentSettingsResponse | null;
}

export interface TodoUpdateScheduledDate {
  scheduledTimestamp: number;
  messageId: string;
  agentSettingsId: string;
}


export interface TempLoginRequest {
  fingerprint: string;
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
  autoSave: boolean;
  confirmBeforeDelete: boolean;
  playSoundOnTaskComplete: boolean;
  showTodoCompletionToast: boolean;
  keyboardBindings?: Record<string, string>;
  keyboardShortcutsEnabled?: boolean;
  defaultViewMode?: string;
}

export interface BetterAuthUser {
  id: string;
  email?: string;
  name?: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  isAnonymous?: boolean | null;
}
export interface UserProfile {
  id: string;
  lastProjectId: string;
  balance: number;
  stripeCustomerId?: string;
  projectIdToAgentId?: Record<string, string>;
  selectedBusinessContextId?: string;
}
export interface UserProfileResponse {
  user: UserProfile;
  settings: AppSettings;
}

export interface AuthResponse {
  user: UserProfile;
  settings: AppSettings;
  token: string;
}

export interface MiniUser {
  id: string;
  email: string;
  isAnonymous: boolean;
  lastProjectId: string;
}

export interface ProjectParams {
  projectId: string;
}

// Project types
export interface ProjectResponse {
  id: string;
  name: string;
  description: string;
  projectSettingsId: string;
  ownerId: string;
  ownerEmail: string;
  isPublic: boolean;
  todoIds: string[];
  readAccessIds: string[];
  writeAccessIds: string[];
  readAccessEmails: string[];
  writeAccessEmails: string[];
  status: ProjectStatus;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}
export interface ProjectSettings {
  id: string;
  projectId: string;
}

export interface ProjectResponseWithSettings {
  project: ProjectResponse;
  settings: ProjectSettings;
}

// Only define what we actually allow to update
export interface ProjectUpdateBody {
  name?: string;
  description?: string;
  isPublic?: boolean;
  status?: ProjectStatus;
}
export interface ProjectCreateBody {
  name: string;
  description?: string;
  isPublic: boolean;
}

export interface ProjectPublicityBody {
  isPublic: boolean;
}

export interface ProjectOwnershipBody {
  newOwnerId: string;
}

export interface TodoChunkResponse {
  id: string;
  projectId: string;
  status: TodoStatus;
  agentSettingsId: string;
  content?: string;
  messageIds: string[];
  createdAt: number;
  lastActivityAt: number;
  scheduledTimestamp: number;
}
export interface TodoResponse {
  id: string;
  projectId: string;
  status: TodoStatus;
  agentSettingsId: string;
  content?: string;
  messageIds: string[];
  messages: MessageResponse[];
  createdAt: number;
  lastActivityAt: number;
  scheduledTimestamp: number;
}

export interface MessageResponse {
  id: string;
  content: string;
  role: string;
  createdAt: number;
  blocks: MessageBlock[];
  scheduledTimestamp: number;
  attachments: AttachmentFrame[];
  runMeta?: RunMeta[];
}

// AgentSettings types
export interface AgentSettingsResponse {
  id: string;
  name: string;
  ownerId: string;
  systemMessage?: string;
  model?: string;
  systemMessageMode?: 'default_coder' | 'custom_w_tools'; // EZ MI?
  smartSystemPrompt?: boolean; // EZ MI?
  mcpConfigs: MCPSettings;
  edgesMcpConfigs: MCPEdgesSettings;
  templateId?: string; // Optional: tracks which template this was created from
  createdAt: number;
  updatedAt: number;
}
export type AgentSettingsUpdate = Omit<AgentSettingsResponse, 'id' | 'ownerId' | 'createdAt'>;

export interface AgentSettingsParams {
  agentSettingsId: string;
}

export interface AgentEdgeRequest {
  edgeId: string;
}

export interface EdgeUpdateBody {
  name?: string;
  workspacepaths?: string[];
}

export interface SuccessType {
  success: boolean;
}

// Task types
export interface TaskResponse {
  id: string;
  type: 'TASK_NEW' | 'CODE_EXECUTE' | 'FILE_SAVE' | 'DIR_LIST' | 'INSTANT_APPLY' | 'INSTANT_DIFF' | 'USER_TODO';
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED';
  input?: string;
  createdAt: number;
  error?: string;
}


export interface UserBalanceResponse {
  balance: number;
}

export interface ProjectSettingsResponse {
  id: string;
  projectId: string;
  llmModel?: string;
  llmConfig?: Record<string, any>;
  workspacePaths?: string[];
  skills?: Record<string, any>;
  diff?: string;
  preferences?: Record<string, any>;
}

export interface PaginatedTransactionsResponse {
  transactions: TransactionResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TransactionResponse {
  id: string;
  type: TransactionType;
  amount: number;
  totalAmount?: number;
  description: string;
  source?: string;
  createdAt: number;
}

// API Key creation request
export interface CreateApiKeyRequest {
  name: string;
}

export interface ShareProjectRequest {
  email: string;
  canWrite: boolean;
}

// Agentflow types
export interface AgentflowParams {
  agentflowId: string;
}

export interface AgentflowCreateBody {
  name: string;
  description?: string;
  agentSettingsId: string;
  triggerMCP?: string;
}

export interface AgentflowUpdateBody {
  name?: string;
  description?: string;
  status?: AgentflowStatus;
  triggerMCP?: string;
}

export interface AgentflowResponse {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  agentSettingsId: string;
  ownerId: string;
  status: AgentflowStatus;
  triggerMCP?: string;
  todoIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface TodoWorkflowResponse {
  workflowMeta: string | null;
  workflowVersion: string | null;
}

export interface TodoWorkflowUpdateRequest {
  workflowMeta: string;
  workflowVersion: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface InvoiceResponse {
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

export interface MessageUpdateBody {
  content?: string;
  attachments?: AttachmentFrame[];
  scheduledTimestamp?: number;
  agentSettingsId: string;
  agentSettings?: AgentSettingsResponse;
  filteredEdgeTools?: Record<string, MCPToolSkeleton[]>;
}


export interface DailyUsageResponse {
  dayTS: number;
  totalSpent: number;
  totalAdded: number;
  messageCount: number;
  mcpUsageCount: number;
  modelUsage: Record<string, { inputTokens: number; outputTokens: number; cost: number }>;
  updatedAt: number;
}

export interface UsageResponse {
  dailyUsages: DailyUsageResponse[];
}

// Namespace for organizing endpoint return types
export namespace Endpoints {
  export namespace User {
    export type Profile = UserProfileResponse;
    export type UpdateProfile = { success: boolean };
    export type Balance = UserBalanceResponse;
    export type Transactions = TransactionResponse[];
    export type PaginatedTransactions = PaginatedTransactionsResponse;
    export type CreateApiKey = ApiKeyResponse;
    export type ListApiKeys = ApiKeyResponse[];
    export type GetApiKey = ApiKeyResponse;
    export type ValidateApiKey = { valid: boolean };
    export type Invoices = { invoices: InvoiceResponse[]; hasMore: boolean };
    export type ChangePassword = {
      success: boolean;
      message: string;
    };
  }

  export namespace Auth {
    export type Login = AuthResponse;
    export type Register = AuthResponse;
    export type CreateTemporary = AuthResponse;
    export type TemporaryLogin = AuthResponse;
  }

  export namespace Project {
    export type Get = ProjectResponseWithSettings;
    export type List = ProjectResponseWithSettings[];
    export type Create = ProjectResponseWithSettings;
    export type Update = SuccessType;
    export type Select = SuccessType;
    export type Share = ProjectResponse;
    export type TransferOwnership = ProjectResponse;
    export type UpdatePublicity = ProjectResponse;
    export type Delete = SuccessType;
  }

  export namespace Todo {
    export type Get = TodoResponse;
    export type ShallowGet = TodoChunkResponse;
    export type List = TodoChunkResponse[];
    export type Create = TodoResponse;
    export type Update = SuccessType;
    export type UpdateStartImmediately = TodoUpdateStartImmediately;
    export type AddMessage = MessageResponse;
    export type Workflow = TodoWorkflowResponse;
    export type Select = SuccessType;
    export type AppendMessage = SuccessType;
    export type UpdateMessage = SuccessType;
  }

  export namespace AgentSettings {
    export type Get = AgentSettingsResponse;
    export type List = AgentSettingsResponse[];
    export type Create = AgentSettingsResponse;
    export type Update = AgentSettingsResponse;
    export type UpdateMCPConfig = SuccessType;
    export type Delete = SuccessType;
  }

  export namespace Agentflow {
    export type Get = AgentflowResponse;
    export type List = AgentflowResponse[];
    export type Create = AgentflowResponse;
    export type Update = SuccessType;
    export type Delete = SuccessType;
  }

  export namespace Task {
    export type Get = TaskResponse;
    export type List = TaskResponse[];
    export type Create = TaskResponse;
  }

  export namespace Settings {
    export type GetUser = AppSettings;
    export type UpdateUser = AppSettings;
    export type UpdateUserBilling = { success: boolean; addressValid?: boolean; message?: string };
    export type GetProject = ProjectSettingsResponse;
    export type UpdateProject = ProjectSettingsResponse;
  }

  export namespace Edge {
    export type Get = EdgeData;
    export type List = EdgeData[];
    export type Create = EdgeData;
    export type Update = EdgeData;
  }

  export namespace Usage {
    export type Analytics = UsageResponse;
  }
}

// New interface for updating user profile
export interface UserProfileUpdateRequest {
  name?: string;
  image?: string;
}

// Added interfaces from patch
export interface FileUploadResponse {
  attachmentId: string;
  uri: string;
  isPublic: boolean;
  fileSize: number;
  encoding: string;
}

export interface FileShareResponse {
  shareUrl: string;
  expiresAt: number;
}
