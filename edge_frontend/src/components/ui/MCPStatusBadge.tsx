import React from 'react';
import { styled } from '@/../styled-system/jsx';

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
      READY: {
        color: '#10b981',
        background: 'rgba(16, 185, 129, 0.1)'
      },
      CRASHED: {
        color: '#ef4444',
        background: 'rgba(239, 68, 68, 0.1)'
      },
      INSTALLING: {
        color: '#3b82f6',
        background: 'rgba(59, 130, 246, 0.1)'
      },
      STARTING: {
        color: '#f59e0b',
        background: 'rgba(245, 158, 11, 0.1)'
      },
      STOPPED: {
        color: '#6b7280',
        background: 'rgba(107, 114, 128, 0.1)'
      },
      ERROR: {
        color: '#ef4444',
        background: 'rgba(239, 68, 68, 0.1)'
      },
      default: {
        color: 'var(--muted)',
        background: 'rgba(0, 0, 0, 0.05)'
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

  return (
    <StatusBadge status={normalizedStatus as any}>
      {showSpinner && <Spinner />}
      {normalizedStatus}
    </StatusBadge>
  );
};