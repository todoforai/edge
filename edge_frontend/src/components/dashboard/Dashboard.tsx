import React, { useState } from 'react';
import styled from 'styled-components';
import MCPServersList from './MCPServersList';
import UserMenu from '../header/UserMenu';


const DashboardContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
`;

const DashboardContent = styled.div`
  flex: 1;
  overflow: auto;
`;

export const Dashboard: React.FC = () => {
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');

  const handleViewModeChange = (mode: 'visual' | 'json') => {
    setViewMode(mode);
  };

  return (
    <DashboardContainer>
      <UserMenu />
      <DashboardContent>
        <MCPServersList viewMode={viewMode} onViewModeChange={handleViewModeChange} />
      </DashboardContent>
    </DashboardContainer>
  );
};

export default Dashboard;
