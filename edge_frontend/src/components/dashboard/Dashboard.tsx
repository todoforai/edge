import styled from 'styled-components';
import { useAuthStore } from '../../store/authStore';
import WSMessageViewer from './WSMessageViewer';
import SyncedFilesList from './SyncedFilesList';
import WorkspacePathsList from './WorkspacePathsList';

interface DashboardProps {
  user: {
    email?: string;
    apiKey?: string;
  };
}

export const Dashboard = ({ user }: DashboardProps) => {
  const { logout } = useAuthStore();

  return (
    <DashboardContainer>
      <DashboardHeader>
        <HeaderTitle>Edge Dashboard</HeaderTitle>
        <UserInfoSection>
          {user.email ? <UserInfo>Logged in as: {user.email}</UserInfo> : <UserInfo>API Key: {user.apiKey?.substring(0, 8)}...</UserInfo>}
          <LogoutButton onClick={logout}>Logout</LogoutButton>
        </UserInfoSection>
      </DashboardHeader>

      <DashboardContent>
        <WSMessageViewer />
        <WorkspacePathsList />
        <SyncedFilesList />
      </DashboardContent>
    </DashboardContainer>
  );
};

// Styled Components
const DashboardContainer = styled.div`
  min-height: 100vh;
  background-color: ${(props) => props.theme.colors.background};
  display: flex;
  flex-direction: column;
`;

const DashboardHeader = styled.header`
  background-color: ${(props) => props.theme.colors.navbarBg};
  color: ${(props) => props.theme.colors.foreground};
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: ${(props) => props.theme.shadows.sm};
  border-bottom: 1px solid ${(props) => props.theme.colors.borderColor};
`;

const HeaderTitle = styled.h1`
  margin: 0;
  font-size: 24px;
  color: ${(props) => props.theme.colors.foreground};
`;

const UserInfoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const UserInfo = styled.span`
  font-size: 14px;
  color: ${(props) => props.theme.colors.muted};
`;

const LogoutButton = styled.button`
  background-color: rgba(255, 255, 255, 0.1);
  color: ${(props) => props.theme.colors.foreground};
  border: none;
  padding: 8px 16px;
  border-radius: ${(props) => props.theme.radius.md};
  cursor: pointer;
  transition: background-color 0.2s;
  font-size: 14px;
  background: transparent;
  border: 1px solid ${(props) => props.theme.colors.borderColor};
  text-shadow: none;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
`;

const DashboardContent = styled.div`
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(550px, 1fr));
  gap: 24px;
  max-width: 1400px;
  width: 100%;
`;
