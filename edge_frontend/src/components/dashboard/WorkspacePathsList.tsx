import React, { useState } from 'react';
import styled from 'styled-components';
import { Loader, CheckCircle, Circle, Trash2 } from 'lucide-react';
import MessageListCard from './MessageListCard';
import { useEdgeConfigStore } from '@/store/edgeConfigStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import pythonService from '@/services/python-service';

// Styled Components
const WorkspacePathsContainer = styled.div`
  width: 100%;
  /* Removed min-width: 700px to allow flexible sizing */
`;

const PathItem = styled.div`
  display: flex;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid ${(props) => props.theme.colors.borderColor};
  width: 100%;
  gap: 10px;
`;

const StatusButton = styled.button<{ $isActive: boolean }>`
  background: transparent;
  border: none;
  color: ${(props) => props.$isActive ? '#4CAF50' : '#9E9E9E'};
  display: flex;
  align-items: center;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: background-color 0.2s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.1);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const PathText = styled.span`
  font-size: 14px;
  color: ${(props) => props.theme.colors.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
`;

const RemoveButton = styled.button`
  background: transparent;
  border: none;
  color: #f44336;
  display: flex;
  align-items: center;
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background-color: rgba(244, 67, 54, 0.1);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

interface WorkspacePath {
  path: string;
  isActive: boolean;
}
const defaultArray: string[] = []
const WorkspacePathsList: React.FC = () => {
  // Use specific selectors to only re-render when these values change
  const workspacePaths = useEdgeConfigStore(state => state.config.workspacepaths || defaultArray);
  const activeWorkspaces = useWorkspaceStore(state => state.activeWorkspaces);
  const [isToggling, setIsToggling] = useState<Record<string, boolean>>({});
  const [isRemoving, setIsRemoving] = useState<Record<string, boolean>>({});
  
  // Format workspace paths for display with active status and sort active to top
  const formattedPaths: WorkspacePath[] = React.useMemo(() => {
    const paths = workspacePaths.map(path => ({
      path,
      isActive: activeWorkspaces.includes(path)
    }));
    
    // Sort active workspaces to the top
    return paths.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return 0;
    });
  }, [workspacePaths, activeWorkspaces]);

  // Count of active workspaces
  const activeCount = formattedPaths.filter(wp => wp.isActive).length;
  const totalCount = formattedPaths.length;

  // Handle toggling workspace sync
  const handleToggleSync = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent any parent click handlers from firing
    
    try {
      setIsToggling(prev => ({ ...prev, [path]: true }));
      await pythonService.toggleWorkspaceSync(path);
      // The active workspaces state will be updated via the WebSocket event
    } catch (error) {
      console.error('Error toggling workspace sync:', error);
    } finally {
      setIsToggling(prev => ({ ...prev, [path]: false }));
    }
  };

  // Handle removing workspace path
  const handleRemovePath = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent any parent click handlers from firing
    
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to remove this workspace path?\n\n${path}\n\nThis will revoke access to this directory and all its subdirectories.`
    );
    
    if (!confirmed) return;
    
    try {
      setIsRemoving(prev => ({ ...prev, [path]: true }));
      await pythonService.removeWorkspacePath(path);
      // The workspace paths will be updated via the WebSocket event
    } catch (error) {
      console.error('Error removing workspace path:', error);
      alert('Failed to remove workspace path. Please try again.');
    } finally {
      setIsRemoving(prev => ({ ...prev, [path]: false }));
    }
  };

  // Render a workspace path item
  const renderPathItem = (item: WorkspacePath, _index: number, style: React.CSSProperties) => {
    return (
      <PathItem style={style}>
        <StatusButton 
          $isActive={item.isActive} 
          onClick={(e) => handleToggleSync(item.path, e)}
          disabled={isToggling[item.path] || isRemoving[item.path]}
          title={item.isActive ? "Stop syncing this workspace" : "Start syncing this workspace"}
        >
          {isToggling[item.path] ? (
            <Loader size={16} className="spin" />
          ) : item.isActive ? (
            <CheckCircle size={16} />
          ) : (
            <Circle size={16} />
          )}
        </StatusButton>
        <PathText title={item.path}>{item.path}</PathText>
        <RemoveButton
          onClick={(e) => handleRemovePath(item.path, e)}
          disabled={isRemoving[item.path] || isToggling[item.path]}
          title="Remove this workspace path (revokes access)"
        >
          {isRemoving[item.path] ? (
            <Loader size={14} className="spin" />
          ) : (
            <Trash2 size={14} />
          )}
        </RemoveButton>
      </PathItem>
    );
  };

  return (
    <WorkspacePathsContainer>
      <MessageListCard
        title="Allowed Workspace Paths"
        customCount={`${activeCount}/${totalCount}`}
        messages={formattedPaths}
        renderItem={renderPathItem}
        itemSize={50}
        emptyMessage="No workspace paths configured. Add paths to allow agent access to directories."
        subtitle="These directories are accessible by agents for file operations"
      />
    </WorkspacePathsContainer>
  );
};

export default WorkspacePathsList;
