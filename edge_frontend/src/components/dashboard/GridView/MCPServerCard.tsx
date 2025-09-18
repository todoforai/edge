import React, { useState, useRef, useEffect } from 'react';
import { styled } from '../../../../styled-system/jsx';
import { Terminal, Settings, MoreVertical, ShieldCheck, Trash2 } from 'lucide-react';
import type { MCPEdgeExecutable } from '../../../types/mcp.types';
import { getMCPByCommandArgs } from '../../../data/mcpServersRegistry';

const ServerCard = styled('div', {
  base: {
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    padding: '28px',
    background: 'var(--background)',
    transition: 'all 0.2s',

    '&:hover': {
      borderColor: 'var(--primary)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
    }
  }
});

const ServerHeader = styled('div', {
  base: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
    alignItems: 'flex-start'
  }
});

const ServerIcon = styled('div', {
  base: {
    flexShrink: 0,
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
    background: 'rgba(59, 130, 246, 0.1)',
    overflow: 'hidden',

    '& img': {
      borderRadius: 'var(--radius-md)'
    }
  }
});

const ServerInfo = styled('div', {
  base: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start'
  }
});

const ServerName = styled('h3', {
  base: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--foreground)',
    margin: '0 0 4px 0',
    wordWrap: 'break-word',
    wordBreak: 'break-word',
    hyphens: 'auto'
  }
});

const ServerId = styled('div', {
  base: {
    fontSize: '12px',
    color: 'var(--muted)',
    fontFamily: 'monospace',
    marginBottom: '8px'
  }
});

const ServerTitleRow = styled('div', {
  base: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flex: 1
  }
});

const ServerNameAndCategory = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1
  }
});

const ServerCategory = styled('span', {
  base: {
    fontSize: '12px',
    color: 'var(--muted)',
    background: 'rgba(59, 130, 246, 0.1)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-md-2)',
    display: 'inline-block',
    flexShrink: 0
  }
});

const ServerActions = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px'
  }
});

const ActionButtonsRow = styled('div', {
  base: {
    display: 'flex',
    gap: '8px'
  }
});

const ActionButton = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    padding: 0,
    background: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--muted)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontSize: '16px',

    '&:hover': {
      background: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'var(--primary)',
      color: 'var(--primary)'
    }
  }
});

const DropdownContainer = styled('div', {
  base: {
    position: 'relative'
  }
});

const DropdownMenu = styled('div', {
  base: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    background: 'var(--background)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 100,
    minWidth: '160px'
  },
  variants: {
    isOpen: {
      true: { display: 'block' },
      false: { display: 'none' }
    }
  }
});

const DropdownItem = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    textAlign: 'left',

    '&:first-child': {
      borderRadius: 'var(--radius-md) var(--radius-md) 0 0'
    },

    '&:last-child': {
      borderRadius: '0 0 var(--radius-md) var(--radius-md)'
    }
  },
  variants: {
    disabled: {
      true: {
        opacity: 0.5,
        cursor: 'not-allowed',

        '&:hover': {
          background: 'transparent'
        }
      }
    },
    danger: {
      true: {
        color: '#ef4444',

        '&:hover': {
          background: 'rgba(239, 68, 68, 0.1)'
        }
      },
      false: {
        color: 'var(--foreground)',

        '&:hover': {
          background: 'rgba(59, 130, 246, 0.1)'
        }
      }
    }
  }
});

const ServerDescription = styled('p', {
  base: {
    fontSize: '14px',
    color: 'var(--muted)',
    lineHeight: 1.5,
    margin: 0
  }
});

const ServerStatus = styled('div', {
  base: {
    fontSize: '12px',
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
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

interface MCPServerCardProps {
  instance: MCPEdgeExecutable;
  onUninstall: (instanceId: string) => void;
  onViewLogs: (instance: MCPEdgeExecutable) => void;
  onOpenSettings: (instance: MCPEdgeExecutable) => void;
  showCategory?: boolean;
}

export const MCPServerCard: React.FC<MCPServerCardProps> = ({
  instance,
  onUninstall,
  onViewLogs,
  onOpenSettings,
  showCategory = true,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isBuiltIn = instance.serverId === 'todoforai';
  const registryServer = getMCPByCommandArgs(instance.command, instance.args);
  
  // Create fallback info if not found in registry
  const fallbackInfo = {
        name: `Custom MCP (${instance.command})`,
        description: `Unknown MCP server: ${instance.command} ${instance.args?.join(' ') || ''}`,
        icon: '/logos/default.svg',
        category: ['Custom'],
      };
  
  // Use registry data or fallback
  const displayInfo = registryServer || fallbackInfo!;
  const displayName = displayInfo.name || instance.serverId || 'Unknown Server';
  const displayDescription = displayInfo.description || 'No description available';
  const displayIcon = displayInfo.icon || '/logos/default.png';
  const displayCategory = displayInfo.category?.[0] || 'Custom';

  // Determine status inline (no helper)
  const status = instance.status || 'READY';

  const handleUninstall = () => {
    if (isBuiltIn) return;
    onUninstall(instance.serverId);
    setIsDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <ServerCard>
      <ServerHeader>
        <ServerIcon>
          <img 
            src={displayIcon} 
            alt={displayName}
            width={48} height={48}
          />
        </ServerIcon>
        <ServerTitleRow>
          <ServerInfo>
            <ServerNameAndCategory>
              <ServerName>{displayName}</ServerName>
              {showCategory && <ServerCategory>{displayCategory}</ServerCategory>}
              <ServerStatus status={status as any}>
                {(status === 'INSTALLING' || status === 'STARTING') && <Spinner />}
                {status}
              </ServerStatus>
            </ServerNameAndCategory>
            <ServerId>{instance.serverId}</ServerId>
          </ServerInfo>
          <ServerActions>
            <ActionButtonsRow>
              <ActionButton onClick={() => onViewLogs(instance)} title="View Logs">
                <Terminal size={20} />
              </ActionButton>
              <ActionButton onClick={() => onOpenSettings(instance)} title="Settings">
                <Settings size={20} />
              </ActionButton>
              <DropdownContainer ref={dropdownRef}>
                <ActionButton 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                  title="More options"
                >
                  <MoreVertical size={20} />
                </ActionButton>
                <DropdownMenu isOpen={isDropdownOpen}>
                  <DropdownItem onClick={() => onOpenSettings(instance)}>
                    <Settings size={18} />
                    Configure
                  </DropdownItem>
                  <DropdownItem onClick={() => onViewLogs(instance)}>
                    <Terminal size={18} />
                    View Logs
                  </DropdownItem>
                  <DropdownItem 
                    onClick={handleUninstall}
                    disabled={isBuiltIn}
                    danger={!isBuiltIn}
                  >
                    {isBuiltIn ? <ShieldCheck size={18} /> : <Trash2 size={18} />}
                    {isBuiltIn ? 'Built-in' : 'Remove'}
                  </DropdownItem>
                </DropdownMenu>
              </DropdownContainer>
            </ActionButtonsRow>
          </ServerActions>
        </ServerTitleRow>
      </ServerHeader>
      <ServerDescription>{displayDescription}</ServerDescription>
    </ServerCard>
  );
};
