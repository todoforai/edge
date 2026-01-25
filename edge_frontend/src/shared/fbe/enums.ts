export enum TaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  MARKED_DELETED = 'MARKED_DELETED',
}

export enum TodoStatus {
  TODO = 'TODO', // Initial state
  SCHEDULED = 'SCHEDULED', // Scheduled for future start
  PAUSED = 'PAUSED', // Scheduled but temporarily disabled
  POSTPONED = 'POSTPONED', // Postponed
  REVIEW_REQUESTED = 'REVIEW_REQUESTED', // Review requested
  RUNNING = 'RUNNING', // Running
  STOPPING = 'STOPPING', // Graceful stop requested, finishing current message
  READY = 'READY', // Ready to be checked
  READY_CHECKED = 'READY_CHECKED', // Ready and it was checked
  DONE = 'DONE', // Completed and finalized
  CANCELLED = 'CANCELLED', // Cancelled
  CANCELLED_CHECKED = 'CANCELLED_CHECKED', // Cancelled and it was checked
  ERROR = 'ERROR', // Failed with error
  ERROR_CHECKED = 'ERROR_CHECKED', // Failed with error and it was checked
  ARCHIVED = 'ARCHIVED', // Archived
  DELETED = 'DELETED', // Marked for deletion
}

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum AgentStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  BUSY = 'BUSY',
}
export enum TaskControlSignal {
  CANCEL = 'CANCEL',
  PAUSE = 'PAUSE',
  RESUME = 'RESUME',
  INPUT = 'INPUT',
}

export enum CreateFileResult {
  INITIAL = 'initial',
  CREATING = 'creating',
  COMPLETED = 'completed',
  ERROR = 'error',
}
export enum DiffControl {
  AutoDiff = 'AutoDiff',
  ManualDiff = 'ManualDiff',
}
export enum ShellExecution {
  WaitForConfirmation = 'wait_for_confirmation',
  Always = 'always',
  Never = 'never',
}

export enum ViewMode {
  Split = 'split',
  Unified = 'unified',
  Raw = 'raw',
}

// ... existing code ...

export enum AgentflowStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  PAUSED = 'PAUSED',
}

export enum WorkflowTriggerType {
  WEBHOOK = 'WEBHOOK',
  MCP_WORKFLOW = 'MCP_WORKFLOW',
}
