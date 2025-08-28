import React from 'react';
import styled from '@emotion/styled';
import { useAuthStore } from '../../store/authStore';
import { useEdgeConfigStore } from '../../store/edgeConfigStore';
import { renameEdge } from '../../services/edge-service';

const InfoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: ${(props) => props.theme.radius.md2};
  border: 1px solid ${(props) => props.theme.colors.borderColor};
`;

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Separator = styled.div`
  width: 1px;
  height: 16px;
  background-color: ${(props) => props.theme.colors.borderColor};
  margin: 0 4px;
`;

const Label = styled.span`
  font-size: 12px;
  color: ${(props) => props.theme.colors.muted};
`;

const Value = styled.span`
  font-size: 12px;
  color: ${(props) => props.theme.colors.foreground};
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const CopyableValue = styled.span`
  font-size: 12px;
  color: ${(props) => props.theme.colors.foreground};
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: all;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 2px 4px;
    margin: -2px -4px;
  }
`;

const EditableValue = styled.span`
  font-size: 12px;
  color: ${(props) => props.theme.colors.foreground};
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const EditInput = styled.input`
  font-size: 12px;
  color: ${(props) => props.theme.colors.foreground};
  font-weight: 500;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid ${(props) => props.theme.colors.borderColor};
  border-radius: 4px;
  padding: 2px 6px;
  outline: none;
  width: 120px;

  &:focus {
    border-color: rgba(255, 165, 0, 0.5);
    box-shadow: 0 0 0 2px rgba(255, 165, 0, 0.1);
  }
`;

const StatusDot = styled.div<{ color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${props => props.color};
  margin-right: 6px;
  flex-shrink: 0;
`;

export const EdgeInfo: React.FC = () => {
  const { user, apiUrl } = useAuthStore();
  const { config } = useEdgeConfigStore();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingName, setEditingName] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  // Use either the API URL from the user object or from the store
  const displayUrl = user?.apiUrl || apiUrl || 'Unknown';

  // Get edge info from config - using correct field names
  const edgeName = config.name || 'Unknown Edge';
  const edgeStatus = config.status || 'OFFLINE';

  const handleEdgeIdDoubleClick = async () => {
      try {
        await navigator.clipboard.writeText(config.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch (err) {
        console.error('Failed to copy edge ID to clipboard:', err);
      }
  };

  const handleEdgeNameClick = () => {
    setIsEditing(true);
    setEditingName(edgeName);
  };

  const handleNameSubmit = async () => {
    if (editingName.trim() && editingName.trim() !== edgeName) {
      try {
        const response = await renameEdge(editingName.trim());
        console.log('Edge renamed successfully', response);
      } catch (error) {
        console.error('Failed to rename edge:', error);
        // Reset to original name on error
        setEditingName(edgeName);
      }
    }
    setIsEditing(false);
  };

  const handleNameCancel = () => {
    setIsEditing(false);
    setEditingName('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ONLINE':
        return '#4CAF50';
      case 'OFFLINE':
        return '#9E9E9E';
      case 'CONNECTING':
        return '#FF9800';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <InfoContainer>
      <InfoItem>
        <Label>API:</Label>
        <Value>{displayUrl}</Value>
      </InfoItem>
      <Separator />
      <InfoItem>
        <Label>Edge:</Label>
        <StatusDot color={getStatusColor(edgeStatus)} title={`Status: ${edgeStatus}`} />
        <Value>
          {isEditing ? (
            <EditInput
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleKeyPress}
              autoFocus
              maxLength={50}
            />
          ) : (
            <EditableValue onClick={handleEdgeNameClick} title="Click to rename">
              {edgeName}
            </EditableValue>
          )}
        </Value>
      </InfoItem>
      <Separator />
      <InfoItem>
        <Label>ID:</Label>
        <CopyableValue 
          onDoubleClick={handleEdgeIdDoubleClick} 
          title={copied ? "Copied!" : "Double-click to copy"}
          style={{ color: copied ? '#4CAF50' : undefined }}
        >
          {copied ? "Copied!" : (config.id.length > 8 ? `${config.id.substring(0, 8)}...` : config.id)}
        </CopyableValue>
      </InfoItem>
    </InfoContainer>
  );
};