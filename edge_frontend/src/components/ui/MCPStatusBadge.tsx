import React from 'react';
import { styled } from '@/../styled-system/jsx';
import { MCPRunningStatus } from '../../types/mcp.types';

const StatusBadge = styled('div', {
  base: {
    fontSize: '12px',
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    whiteSpace: 'nowrap'
  },
  variants: {
    status: {
      [MCPRunningStatus.READY]: {
        color: 'var(--success)',
        background: 'rgba(34, 197, 94, 0.1)'
      },
      [MCPRunningStatus.CRASHED]: {
        color: 'var(--danger)',
        background: 'rgba(239, 68, 68, 0.1)'
      },
      [MCPRunningStatus.INSTALLING]: {
        color: 'var(--primary)',
        background: 'rgba(59, 130, 246, 0.1)'
      },
      [MCPRunningStatus.STARTING]: {
        color: 'var(--warning)',
        background: 'rgba(245, 158, 11, 0.1)'
      },
      [MCPRunningStatus.STOPPED]: {
        color: 'var(--muted-foreground)',
        background: 'var(--muted)'
      },
      [MCPRunningStatus.ERROR]: {
        color: 'var(--danger)',
        background: 'rgba(239, 68, 68, 0.1)'
      },
      [MCPRunningStatus.UNINSTALLED]: {
        color: 'var(--muted-foreground)',
        background: 'var(--muted)'
      },
      [MCPRunningStatus.INSTALLED]: {
        color: 'var(--muted-foreground)',
        background: 'var(--muted)'
      },
      [MCPRunningStatus.RUNNING]: {
        color: 'var(--success)',
        background: 'rgba(34, 197, 94, 0.1)'
      },
      default: {
        color: 'var(--muted-foreground)',
        background: 'var(--muted)'
      }
    }
  }
});

const Spinner = styled('div', {
  base: {
    width: '12px',
    height: '12px',
    border: '2px solid transparent',
    borderTop: '2px solid currentColor',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
});

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
    <StatusBadge status={badgeStatus as MCPRunningStatus | 'default'}>
      {showSpinner && <Spinner />}
      {normalizedStatus}
    </StatusBadge>
  );
};