import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Settings, MoreVertical, ShieldCheck, Trash2 } from 'lucide-react';
import { cva } from "class-variance-authority";
import type { MCPEdgeExecutable } from '../../../types/mcp.types';
import { getMCPByCommandArgs } from '../../../data/mcpServersRegistry';
import { MCPStatusBadge } from '../../ui/MCPStatusBadge';
import { Button } from '../../ui/button';

const serverCard = cva([
  "border border-border rounded-xl p-6 bg-card transition-all hover:border-primary hover:shadow-md"
]);

const serverHeader = cva([
  "flex items-start justify-between gap-4 mb-4"
]);

const serverMainInfo = cva([
  "flex gap-3 flex-1 min-w-0"
]);

const serverIcon = cva([
  "flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-md bg-accent overflow-hidden"
]);

const serverIconImage = cva([
  "rounded-md"
]);

const serverInfo = cva([
  "flex flex-col min-w-0 flex-1"
]);

const serverTitleRow = cva([
  "flex items-center gap-2 mb-1 flex-wrap"
]);

const serverName = cva([
  "text-base font-semibold text-foreground m-0 break-words hyphens-auto"
]);

const serverCategory = cva([
  "text-xs text-muted-foreground bg-accent px-2 py-0.5 rounded-md inline-block flex-shrink-0"
]);

const serverId = cva([
  "text-xs text-muted-foreground font-mono mb-2"
]);

const serverActions = cva([
  "flex items-start gap-1 flex-shrink-0"
]);

const dropdownContainer = cva([
  "relative"
]);

const dropdownMenu = cva([
  "absolute top-full right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-[100] min-w-[160px]"
], {
  variants: {
    isOpen: {
      true: "block",
      false: "hidden"
    }
  }
});

const dropdownItem = cva([
  "flex items-center gap-2 w-full p-3 bg-transparent border-none text-sm cursor-pointer transition-colors text-left first:rounded-t-md last:rounded-b-md"
], {
  variants: {
    disabled: {
      true: "opacity-50 cursor-not-allowed hover:bg-transparent",
      false: ""
    },
    danger: {
      true: "text-destructive hover:bg-destructive/10",
      false: "text-foreground hover:bg-accent"
    }
  }
});

const serverDescription = cva([
  "text-sm text-muted-foreground leading-relaxed m-0"
]);

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
    <div className={serverCard()}>
      <div className={serverHeader()}>
        <div className={serverMainInfo()}>
          <div className={serverIcon()}>
            <img 
              src={displayIcon} 
              alt={displayName}
              width={48} height={48}
              className={serverIconImage()}
            />
          </div>
          <div className={serverInfo()}>
            <div className={serverTitleRow()}>
              <h3 className={serverName()}>{displayName}</h3>
              {showCategory && <span className={serverCategory()}>{displayCategory}</span>}
              <MCPStatusBadge status={instance.status} />
            </div>
            <div className={serverId()}>{instance.serverId}</div>
          </div>
        </div>
        <div className={serverActions()}>
          <Button variant="outline" size="icon" onClick={() => onViewLogs(instance)} title="View Logs">
            <Terminal size={18} />
          </Button>
          <Button variant="outline" size="icon" onClick={() => onOpenSettings(instance)} title="Settings">
            <Settings size={18} />
          </Button>
          <div className={dropdownContainer()} ref={dropdownRef}>
            <Button 
              variant="outline"
              size="icon"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
              title="More options"
            >
              <MoreVertical size={18} />
            </Button>
            <div className={dropdownMenu({ isOpen: isDropdownOpen })}>
              <button className={dropdownItem()} onClick={() => onOpenSettings(instance)}>
                <Settings size={18} />
                Configure
              </button>
              <button className={dropdownItem()} onClick={() => onViewLogs(instance)}>
                <Terminal size={18} />
                View Logs
              </button>
              <button 
                className={dropdownItem({ disabled: isBuiltIn, danger: !isBuiltIn })}
                onClick={handleUninstall}
                disabled={isBuiltIn}
              >
                {isBuiltIn ? <ShieldCheck size={18} /> : <Trash2 size={18} />}
                {isBuiltIn ? 'Built-in' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <p className={serverDescription()}>{displayDescription}</p>
    </div>
  );
};
