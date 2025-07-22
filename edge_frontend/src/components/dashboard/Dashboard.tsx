import React, { useState } from 'react';
import styled from 'styled-components';
import WorkspacePathsList from './WorkspacePathsList';
import SyncedFilesList from './SyncedFilesList';
import WSMessageViewer from './WSMessageViewer';
import MCPServersList from './MCPServersList';
import UserMenu from '../header/UserMenu';

export const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'edge' | 'mcp'>('edge');

  return (
    <DashboardContainer>
      <UserMenu />
<TabContainer>
        <Tab 
          $active={activeTab === 'edge'} 
          onClick={() => setActiveTab('edge')}
        >
          Edge Status
        </Tab>
        <Tab 
          $active={activeTab === 'mcp'} 
          onClick={() => setActiveTab('mcp')}
        >
          MCP Registry
        </Tab>
      </TabContainer>

      <TabContent>
        {activeTab === 'edge' && (
          <DashboardGrid>
            <GridItem>
              <WorkspacePathsList />
            </GridItem>
            <GridItem>
              <SyncedFilesList />
            </GridItem>
            <GridItem>
              <WSMessageViewer />
            </GridItem>
          </DashboardGrid>
        )}

        {activeTab === 'mcp' && (
          <MCPDashboard>
            <MCPServersList />
          </MCPDashboard>
        )}
      </TabContent>
    </DashboardContainer>
  );
};

const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => props.theme.colors.borderColor};
  background: ${props => props.theme.colors.background};
  padding: 0 20px;
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 16px 24px;
  border: none;
  background: transparent;
  color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.mutedForeground};
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid ${props => props.$active ? props.theme.colors.primary : 'transparent'};
  transition: all 0.2s;

  &:hover {
    color: ${props => props.theme.colors.primary};
    background: rgba(59, 130, 246, 0.05);
  }
`;

const TabContent = styled.div`
  flex: 1;
  overflow: hidden;
`;

const DashboardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 20px;
  padding: 20px;
  height: 100%;
  overflow: hidden;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, minmax(300px, 1fr));
  }
`;

const GridItem = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 8px;
`;

const MCPDashboard = styled.div`
  height: 100%;
  overflow-y: auto;
`;

export default Dashboard;
