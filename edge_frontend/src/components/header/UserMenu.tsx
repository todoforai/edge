import React from 'react';
import styled from 'styled-components';
import { useAuthStore } from '../../store/authStore';
import { useEdgeConfigStore } from '../../store/edgeConfigStore';
import { Icon } from '@iconify/react';
import { renameEdge } from '../../services/edge-service';

const ProfileButton = styled.button`
  background: ${(props) => props.theme.colors.cardBackground};
  border: 1px solid ${(props) => props.theme.colors.borderColor};
  padding: 0;
  width: 2.5rem;
  height: 2.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => props.theme.colors.foreground};
  border-radius: 50%;
  transition: all 0.3s ease;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
    box-shadow: 0px 0px 10px rgba(255, 165, 0, 0.1);
  }
`;

const ProfileImage = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: transparent;
`;

const UserContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const DropdownContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const DropdownContent = styled.div`
  display: none;
  position: absolute;
  left: 0;
  min-width: 220px;
  background: ${(props) => props.theme.colors.cardBackground};
  border-radius: ${(props) => props.theme.radius.lg};
  padding: 0.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  border: 1px solid ${(props) => props.theme.colors.borderColor};
  z-index: 100;

  ${DropdownContainer}:hover & {
    display: block;
  }
`;

const EmailHeader = styled.div`
  padding: 0.75rem 1rem;
  color: ${(props) => props.theme.colors.foreground};
  font-size: 0.9rem;
  border-bottom: 1px solid ${(props) => props.theme.colors.borderColor};
  margin-bottom: 0.5rem;
  opacity: 0.8;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const DropdownItem = styled.div`
  padding: 0.5rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: ${(props) => props.theme.colors.foreground};
  border-radius: ${(props) => props.theme.radius.md};

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1rem;
  background: ${(props) => props.theme.colors.cardBackground};
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;


export const UserMenu: React.FC = () => {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
  };

  if (!user) return null;

  return (
    <HeaderContainer>
      <LeftSection>
        <DropdownContainer>
          <UserContainer>
            <ProfileButton>
              <ProfileImage>
                <Icon icon="lucide:user" style={{ width: '1.5rem', height: '1.5rem' }} />
              </ProfileImage>
            </ProfileButton>
          </UserContainer>
          <DropdownContent>
            <EmailHeader>
              <Icon icon="lucide:mail" />
              {user.email || 'User'}
            </EmailHeader>
            <DropdownItem onClick={handleLogout}>
              <Icon icon="lucide:log-out" />
              <span>Logout</span>
            </DropdownItem>
          </DropdownContent>
        </DropdownContainer>
        <EdgeInfoDisplay />
      </LeftSection>
    </HeaderContainer>
  );
};

const EdgeInfoDisplay: React.FC = () => {
  const { user, apiUrl } = useAuthStore();
  const { config } = useEdgeConfigStore();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingName, setEditingName] = React.useState('');

  // Use either the API URL from the user object or from the store
  const displayUrl = user?.apiUrl || apiUrl || 'Unknown';

  // Get edge info from config
  const edgeId = config.id || 'Unknown';
  const edgeName = config.name || 'Unknown Edge';

  const handleEdgeIdDoubleClick = async () => {
    if (edgeId && edgeId !== 'Unknown') {
      try {
        await navigator.clipboard.writeText(edgeId);
      } catch (err) {
        console.error('Failed to copy edge ID to clipboard:', err);
      }
    }
  };

  const handleEdgeNameClick = () => {
    setIsEditing(true);
    setEditingName(edgeName);
  };

  const handleNameSubmit = async () => {
    if (editingName.trim() && editingName.trim() !== edgeName) {
      try {
        await renameEdge(edgeId, editingName.trim());
        console.log('Edge renamed successfully');
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

  return (
    <InfoContainer>
      <InfoItem>
        <Label>API:</Label>
        <Value>{displayUrl}</Value>
      </InfoItem>
      <Separator />
      <InfoItem>
        <Label>Edge:</Label>
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
        <CopyableValue onDoubleClick={handleEdgeIdDoubleClick} title="Double-click to copy">
          {edgeId.length > 8 ? `${edgeId.substring(0, 8)}...` : edgeId}
        </CopyableValue>
      </InfoItem>
    </InfoContainer>
  );
};

const InfoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: ${(props) => props.theme.radius.md};
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

export default UserMenu;
