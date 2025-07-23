import React from 'react';
import styled from 'styled-components';
import { useAuthStore } from '../../store/authStore';
import { useEdgeConfigStore } from '../../store/edgeConfigStore';
import { Icon } from '@iconify/react';

// Status colors
const STATUS_COLORS = {
  ONLINE: '#4CAF50',      // Green
  OFFLINE: '#F44336',     // Red  
  CONNECTING: '#FFC107',  // Yellow
  running: '#4CAF50',     // Green
  installed: '#2196F3',   // Blue
  stopped: '#FF9800',     // Orange
  uninstalled: '#292222', // Dark grey
  default: '#9E9E9E'      // Grey
} as const;

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


const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const ViewPicker = styled.div`
  display: flex;
  align-items: center;
  background: ${(props) => props.theme.colors.cardBackground};
  border: 1px solid ${(props) => props.theme.colors.borderColor};
  border-radius: ${(props) => props.theme.radius.lg};
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const ViewButton = styled.button<{ active?: boolean }>`
  background: ${(props) => props.active ? props.theme.colors.primary : 'transparent'};
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => props.active ? '#ffffff' : props.theme.colors.muted};
  transition: all 0.2s ease;
  width: 2rem;
  height: 2rem;

  &:hover {
    background: ${(props) => props.active ? props.theme.colors.primary : 'rgba(255, 255, 255, 0.1)'};
    color: ${(props) => props.active ? '#ffffff' : props.theme.colors.foreground};
  }
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
  const [showEdgeId, setShowEdgeId] = React.useState(false);

  // Use either the API URL from the user object or from the store
  const displayUrl = user?.apiUrl || apiUrl || 'Unknown';

  // Get edge info from config
  const edgeId = config.id || 'Unknown';
  const edgeName = config.name || 'Unknown Edge';

  const handleEdgeNameDoubleClick = () => {
    setShowEdgeId(!showEdgeId);
  };

  const handleEdgeIdDoubleClick = async () => {
    if (edgeId && edgeId !== 'Unknown') {
      try {
        await navigator.clipboard.writeText(edgeId);
      } catch (err) {
        console.error('Failed to copy edge ID to clipboard:', err);
      }
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
          <CopyableValue onDoubleClick={handleEdgeNameDoubleClick} title="Double-click to show/hide Edge ID">
            {edgeName}
          </CopyableValue>
        </Value>
      </InfoItem>
      {showEdgeId && (
        <>
          <Separator />
          <InfoItem>
            <Label>ID:</Label>
            <CopyableValue onDoubleClick={handleEdgeIdDoubleClick} title="Double-click to copy">
              {edgeId}
            </CopyableValue>
          </InfoItem>
        </>
      )}
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

export default UserMenu;
