import React, { useState } from 'react';
import styled from 'styled-components';
import MessageListCard from './MessageListCard';
import { useEdgeConfigStore } from '@/store/edgeConfigStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Icon } from '@iconify/react';
import pythonService from '@/services/python-service';

interface WorkspacePath {
  path: string;
  isActive: boolean;
}

const WorkspacePathsList: React.FC = () => {
  // Use specific selectors to only re-render when these values change
  const workspacePaths = useEdgeConfigStore(state => state.config.workspacepaths || []);
  const activeWorkspaces = useWorkspaceStore(state => state.activeWorkspaces);
  const [isToggling, setIsToggling] = useState<Record<string, boolean>>({});
  
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

  // Render a workspace path item
  const renderPathItem = (item: WorkspacePath, _index: number, style: React.CSSProperties) => {
    return (
      <PathItem style={style}>
        <StatusButton 
          isActive={item.isActive} 
          onClick={(e) => handleToggleSync(item.path, e)}
          disabled={isToggling[item.path]}
        >
          {isToggling[item.path] ? (
            <Icon icon="lucide:loader" className="spin" />
          ) : item.isActive ? (
            <Icon icon="lucide:check-circle" />
          ) : (
            <Icon icon="lucide:circle" />
          )}
        </StatusButton>
        <PathText>{item.path}</PathText>
      </PathItem>
    );
  };

  return (
    <WorkspacePathsContainer>
      <MessageListCard
        title="Workspaces"
        customCount={`${activeCount}/${totalCount}`}
        messages={formattedPaths}
        renderItem={renderPathItem}
        itemSize={50}
        emptyMessage="No workspace paths configured"
      />
    </WorkspacePathsContainer>
  );
};

// Styled Components
const WorkspacePathsContainer = styled.div`
  width: 100%;
  min-width: 700px; /* Set minimum width */
`;

const PathItem = styled.div`
  display: flex;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid ${(props) => props.theme.colors.borderColor};
  width: 100%;
`;

const StatusButton = styled.button<{ isActive: boolean }>`
  background: transparent;
  border: none;
  color: ${(props) => props.isActive ? '#4CAF50' : '#9E9E9E'};
  margin-right: 10px;
  display: flex;
  align-items: center;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: background-color 0.2s;

  &:hover {
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
`;

export default WorkspacePathsList;
