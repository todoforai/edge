import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useWSMessageStore } from '@/store/wsMessageStore';
import MessageListCard from './MessageListCard';
import path from 'path-browserify';
import type { ColorKey } from '@/styles/theme';

interface SyncedFile {
  filename: string;
  timestamp: number;
  action: string;
  size?: number;
}

// Format file size
const formatFileSize = (bytes?: number) => {
  if (bytes === undefined) return '';

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// Format time difference
const formatTimeDiff = (timestamp: number) => {
  const now = Date.now();
  const diffSeconds = Math.floor((now - timestamp) / 1000);

  if (diffSeconds < 60) return `${diffSeconds} secs ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} mins ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hours ago`;
  return `${Math.floor(diffSeconds / 86400)} days ago`;
};

// Individual FileItem component with its own timestamp management
const FileItem: React.FC<{ file: SyncedFile; style: React.CSSProperties }> = ({ file, style }) => {
  const [_currentTime, setCurrentTime] = useState(Date.now()); // Renamed to avoid conflict if currentTime was used directly

  useEffect(() => {
    const updateTimestamp = () => {
      const now = Date.now();
      setCurrentTime(now);
      
      // Determine next update interval based on file age
      const diffSeconds = Math.floor((now - file.timestamp) / 1000);
      
      let nextInterval: number;
      if (diffSeconds < 60) {
        // Update every 5 seconds for files less than 1 minute old
        nextInterval = 5000;
      } else if (diffSeconds < 3600) {
        // Update every 30 seconds for files less than 1 hour old
        nextInterval = 30000;
      } else {
        // Update every 5 minutes for older files
        nextInterval = 300000;
      }
      
      const timeoutId = setTimeout(updateTimestamp, nextInterval);
      return () => clearTimeout(timeoutId);
    };
    
    // Start the update cycle
    const cleanup = updateTimestamp();
    
    return cleanup;
  }, [file.timestamp]);

  // Get action icon/color
  const getActionIndicator = (action: string): { icon: string; color: ColorKey } => {
    switch (action) {
      case 'create':
        return { icon: '+', color: 'success' as ColorKey };
      case 'modify':
        return { icon: '✎', color: 'warning' as ColorKey };
      case 'delete':
        return { icon: '−', color: 'danger' as ColorKey };
      default:
        return { icon: '•', color: 'muted' as ColorKey };
    }
  };

  const { icon, color } = getActionIndicator(file.action);

  return (
    <FileItemContainer style={style}>
      <FileDetails>
        <ActionIndicator color={color}>{icon}</ActionIndicator>
        <FileName>{file.filename}</FileName>
        {file.size !== undefined && <FileSize>{formatFileSize(file.size)}</FileSize>}
      </FileDetails>
      <FileTimestamp>{formatTimeDiff(file.timestamp)}</FileTimestamp>
    </FileItemContainer>
  );
};

const SyncedFilesList: React.FC = () => {
  const { messages } = useWSMessageStore();

  // Extract synced files from websocket messages
  let syncedFiles: SyncedFile[] = messages
    .filter((msg) => msg.type === 'file_sync')
    .map((msg) => {
      const fullPath = msg.payload?.path || '';
      const workspace = msg.payload?.workspace || '';

      // Format the path to show @workspace/relative/path
      let displayPath = fullPath;
      if (workspace && fullPath.startsWith(workspace)) {
        // Get the relative path and format it with the workspace name
        const workspaceName = path.basename(workspace);
        const relativePath = fullPath.substring(workspace.length);
        displayPath = `@${workspaceName}${relativePath}`;
      }

      return {
        filename: displayPath,
        timestamp: msg.timestamp || Date.now(),
        action: msg.payload?.action || 'unknown',
        size: msg.payload?.size,
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp); // Sort by most recent first

  // Render a file item
  const renderFileItem = (file: SyncedFile, _index: number, style: React.CSSProperties) => {
    return <FileItem file={file} style={style} />;
  };

  return (
    <SyncedFilesContainer>
      <MessageListCard
        title="Synced Files"
        messages={syncedFiles}
        renderItem={renderFileItem}
        itemSize={50}
        emptyMessage="No files have been synced yet"
      />
    </SyncedFilesContainer>
  );
};

// Styled Components
const SyncedFilesContainer = styled.div`
  width: 100%;
`;

const FileItemContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid ${(props) => props.theme.colors.borderColor};
  width: 100%;
`;

const FileDetails = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  max-width: 80%;
`;

const ActionIndicator = styled.span<{ color: ColorKey }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: bold;
  color: ${(props) => props.theme.colors[props.color]};
`;

const FileName = styled.span`
  font-size: 14px;
  color: ${(props) => props.theme.colors.foreground};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileSize = styled.span`
  font-size: 12px;
  color: ${(props) => props.theme.colors.muted};
  margin-left: 8px;
  white-space: nowrap;
`;

const FileTimestamp = styled.span`
  font-size: 12px;
  color: ${(props) => props.theme.colors.muted};
  white-space: nowrap;
`;

export default SyncedFilesList;
