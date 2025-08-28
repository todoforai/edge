import React, { useState } from 'react';
import styled from '@emotion/styled';
import MCPServersList from './GridView/MCPServersList';
import { MCPServerJSONView } from './JSONView/MCPServerJSONView';
import { ActionBar } from './ActionBar';
import Profile from '../navbar/Profile';
import { useEdgeConfigStore } from '../../store/edgeConfigStore';
import { useMCPFilters } from '../../hooks/useMCPFilters';
import pythonService from '../../services/python-service';

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

const Container = styled.div`
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 30px;
  text-align: center;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 600;
  color: ${props => props.theme.colors.foreground};
  margin: 0 0 8px 0;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.mutedForeground};
  margin: 0;
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 30px;
`;

export const Dashboard: React.FC = () => {
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { getMCPInstances } = useEdgeConfigStore();
  
  const { 
    searchTerm, 
    setSearchTerm, 
    selectedCategory, 
    setSelectedCategory,
    filteredInstances,
    categories 
  } = useMCPFilters(getMCPInstances());

  const handleViewModeChange = (mode: 'visual' | 'json') => {
    setViewMode(mode);
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const result = await pythonService.refreshMCPConfig();
      console.log('MCP config refresh result:', result);
    } catch (error) {
      console.error('Failed to refresh MCP config:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <DashboardContainer>
      <Profile />
      <DashboardContent>
        <Container>
          <Header>
            <Title>AI Extensions</Title>
            <Subtitle>Extend agent capabilities with integrations along the internet and your PC. Discover and install!</Subtitle>
          </Header>

          <Controls>
            <ActionBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search MCP servers..."
              selectedCategory={selectedCategory}
              categories={categories}
              onCategoryChange={setSelectedCategory}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              showViewPicker={true}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
            />
          </Controls>

          {viewMode === 'json' ? (
            <MCPServerJSONView 
              instances={filteredInstances} 
              onInstancesChange={() => console.warn("onInstancesChange: Direct state update for instances is deprecated. Update config.mcp_json instead.")} 
            />
          ) : (
            <MCPServersList 
              instances={filteredInstances}
              selectedCategory={selectedCategory}
            />
          )}
        </Container>
      </DashboardContent>
    </DashboardContainer>
  );
};

export default Dashboard;
