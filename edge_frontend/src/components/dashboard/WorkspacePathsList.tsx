import React from 'react';
import styled from 'styled-components';
import { useWSMessageStore } from '@/store/wsMessageStore';
import MessageListCard from './MessageListCard';
import path from 'path-browserify';

interface WorkspacePath {
  path: string;
  name: string;
  isActive: boolean;
  timestamp: number;
}

const WorkspacePathsList: React.FC = () => {
  const { messages } = useWSMessageStore();

  // Extract workspace paths from the message store
  const workspacePaths: WorkspacePath[] = React.useMemo(() => {
    // Find the most recent edge:workspace_paths message
    const latestWorkspacePathsMsg = messages
      .filter(msg => msg.type === 'edge:workspace_paths')
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      [0];

    if (!latestWorkspacePathsMsg?.payload?.workspacePaths) {
      return [];
    }

    // Transform the paths into a more usable format
    return latestWorkspacePathsMsg.payload.workspacePaths.map((p: string) => ({
      path: p,
      name: path.basename(p),
      isActive: true, // Assume all paths are active
      timestamp: latestWorkspacePathsMsg.timestamp || Date.now()
    }));
  }, [messages]);

  // Render a workspace path item
  const renderWorkspaceItem = (workspace: WorkspacePath, _index: number, style: React.CSSProperties) => {
    return (
      <WorkspaceItem style={style}>
        <WorkspaceDetails>
          <StatusIndicator active={workspace.isActive} />
          <WorkspaceName>{workspace.name}</WorkspaceName>
        </WorkspaceDetails>
        <WorkspacePath>{workspace.path}</WorkspacePath>
      </WorkspaceItem>
    );
  };

  return (
    <MessageListCard
      title="Workspace Paths"
      messages={workspacePaths}
      renderItem={renderWorkspaceItem}
      itemSize={60}
      emptyMessage="No workspace paths configured"
    />
  );
};

// Styled Components
const WorkspaceItem = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 10px;
  border-bottom: 1px solid ${(props) => props.theme.colors.borderColor};
  width: 100%;
`;

const WorkspaceDetails = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
`;

const StatusIndicator = styled.div<{ active: boolean }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${(props) => (props.active ? props.theme.colors.success : props.theme.colors.muted)};
`;

const WorkspaceName = styled.span`
  font-size: 14px;
  font-weight: bold;
  color: ${(props) => props.theme.colors.foreground};
`;

const WorkspacePath = styled.span`
  font-size: 12px;
  color: ${(props) => props.theme.colors.muted};
  margin-left: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export default WorkspacePathsList;