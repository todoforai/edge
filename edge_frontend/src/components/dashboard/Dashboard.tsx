import React, { useMemo, useState } from 'react';
import MCPServersList from './GridView/MCPServersList';
import { MCPServerJSONView } from './JSONView/MCPServerJSONView';
import { ActionBar } from './ActionBar';
import Profile from '../navbar/Profile';
import { useEdgeConfigStore } from '../../store/edgeConfigStore';
import { useMCPFilters } from '../../hooks/useMCPFilters';
import pythonService from '../../services/python-service';
import { cva } from "class-variance-authority";

const dashboardContainer = cva([
  "flex flex-col h-screen w-full"
]);

const dashboardContent = cva([
  "flex-1 overflow-auto"
]);

const container = cva([
  "p-5 max-w-[1200px] mx-auto"
]);

const header = cva([
  "mb-8 text-center"
]);

const title = cva([
  "text-3xl font-semibold text-foreground m-0 mb-2"
]);

const subtitle = cva([
  "text-base text-muted-foreground m-0"
]);

const configPath = cva([
  "text-[13px] text-muted-foreground mt-2 mb-0 font-mono opacity-70"
]);

const controls = cva([
  "flex flex-col gap-5 mb-8"
]);

export const Dashboard: React.FC = () => {
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const config = useEdgeConfigStore(state => state.config);
  const getMCPInstances = useEdgeConfigStore(state => state.getMCPInstances);
  const instances = useMemo(() => getMCPInstances(config), [config, getMCPInstances]);

  const { 
    searchTerm, 
    setSearchTerm, 
    selectedCategory, 
    setSelectedCategory,
    filteredInstances,
    categories 
  } = useMCPFilters(instances);

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
    <div className={dashboardContainer()}>
      <Profile />
      <div className={dashboardContent()}>
        <div className={container()}>
          <div className={header()}>
            <h1 className={title()}>AI Integrations</h1>
            <p className={subtitle()}>Extend agent capabilities with integrations along the internet and your PC. Discover and install!</p>
            {config.mcp_config_path && (
              <p className={configPath()}>Config: {config.mcp_config_path}</p>
            )}
          </div>

          <div className={controls()}>
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
          </div>

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
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
