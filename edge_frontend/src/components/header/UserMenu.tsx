import React from 'react';
import styled from 'styled-components';
import { useAuthStore } from '../../store/authStore';
import { useEdgeConfigStore } from '../../store/edgeConfigStore';
import { Icon } from '@iconify/react';

const ProfileButton = styled.button`
  background: ${props => props.theme.colors.cardBackground};
  border: 1px solid ${props => props.theme.colors.borderColor};
  padding: 0;
  width: 2.5rem;
  height: 2.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme.colors.foreground};
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
  right: 0;
  min-width: 220px;
  background: ${props => props.theme.colors.cardBackground};
  border-radius: ${props => props.theme.radius.lg};
  padding: 0.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  border: 1px solid ${props => props.theme.colors.borderColor};
  z-index: 100;
  
  ${DropdownContainer}:hover & {
    display: block;
  }
`;

const EmailHeader = styled.div`
  padding: 0.75rem 1rem;
  color: ${props => props.theme.colors.foreground};
  font-size: 0.9rem;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
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
  color: ${props => props.theme.colors.foreground};
  border-radius: ${props => props.theme.radius.md};
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: ${props => props.theme.colors.cardBackground};
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  margin-bottom: 1rem;
`;

export const UserMenu = () => {
  const { user, logout } = useAuthStore();
  
  const handleLogout = () => {
    logout();
  };

  if (!user) return null;

  return (
    <HeaderContainer>
      <EdgeInfoDisplay />
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
    </HeaderContainer>
  );
};

const EdgeInfoDisplay: React.FC = () => {
  const { user, apiUrl } = useAuthStore();
  const { config } = useEdgeConfigStore();
  
  // Use either the API URL from the user object or from the store
  const displayUrl = user?.apiUrl || apiUrl || 'Unknown';
  
  // Get edge name from config
  const edgeName = config.name || 'Unknown Edge';
  const edgeStatus = config.status || 'OFFLINE';
  
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
          <StatusIndicator status={edgeStatus} />
          {edgeName}
        </Value>
      </InfoItem>
    </InfoContainer>
  );
};

// Status indicator component
const StatusIndicator: React.FC<{ status: string }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'ONLINE':
        return '#4CAF50'; // Green
      case 'OFFLINE':
        return '#F44336'; // Red
      case 'CONNECTING':
        return '#FFC107'; // Yellow
      default:
        return '#9E9E9E'; // Grey
    }
  };
  
  return (
    <StatusDot style={{ backgroundColor: getStatusColor() }} />
  );
};

const InfoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background-color: ${props => props.theme.colors.cardBackground};
  border-radius: ${props => props.theme.radius.md};
  border: 1px solid ${props => props.theme.colors.borderColor};
`;

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Separator = styled.div`
  width: 1px;
  height: 16px;
  background-color: ${props => props.theme.colors.borderColor};
  margin: 0 4px;
`;

const Label = styled.span`
  font-size: 12px;
  color: ${props => props.theme.colors.muted};
`;

const Value = styled.span`
  font-size: 12px;
  color: ${props => props.theme.colors.foreground};
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const StatusDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 2px;
`;

export default UserMenu;