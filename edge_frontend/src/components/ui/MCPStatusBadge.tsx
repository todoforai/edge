import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { MCPRunningStatus } from '../../types/mcp.types';

const statusBadgeVariants = cva(
  "text-xs font-medium px-2 py-1 rounded-sm inline-flex items-center gap-1 whitespace-nowrap",
  {
    variants: {
      status: {
        [MCPRunningStatus.READY]: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20",
        [MCPRunningStatus.CRASHED]: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20",
        [MCPRunningStatus.INSTALLING]: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20",
        [MCPRunningStatus.STARTING]: "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20",
        [MCPRunningStatus.STOPPED]: "text-muted-foreground bg-muted",
        [MCPRunningStatus.ERROR]: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20",
        [MCPRunningStatus.UNINSTALLED]: "text-muted-foreground bg-muted",
        [MCPRunningStatus.INSTALLED]: "text-muted-foreground bg-muted",
        [MCPRunningStatus.RUNNING]: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20",
        default: "text-muted-foreground bg-muted"
      }
    }
  }
);

const spinnerVariants = cva(
  "w-3 h-3 border-2 border-transparent border-t-current rounded-full animate-spin"
);

interface MCPStatusBadgeProps {
  status?: string;
}

export const MCPStatusBadge: React.FC<MCPStatusBadgeProps> = ({ status = 'READY' }) => {
  const normalizedStatus = status.toUpperCase();
  const showSpinner = normalizedStatus === 'INSTALLING' || normalizedStatus === 'STARTING';
  
  const badgeStatus = Object.values(MCPRunningStatus).includes(normalizedStatus as MCPRunningStatus)
    ? normalizedStatus as MCPRunningStatus
    : 'default';

  return (
    <div className={cn(statusBadgeVariants({ status: badgeStatus as MCPRunningStatus | 'default' }))}>
      {showSpinner && <div className={cn(spinnerVariants())} />}
      {normalizedStatus}
    </div>
  );
};